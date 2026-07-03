// ═══════════════════════════════════════════════════════════
// SOLARISCREEN — Moteur de prix (fonctions pures, testables)
// Porté à l'identique du calculateur v1. Script classique : window.SSCalc
// ═══════════════════════════════════════════════════════════
(function () {
  // ── Constantes métier ──
  const SUPPLIER_RATE   = 0.77; // achat fournisseur estimé = 77% du catalogue
  const MATERIAL_MARGIN = 0.23; // marge matériel brute = 23% du catalogue
  const NET_DIVISOR     = 2.5;  // net = brut / 2.5
  const DEFAULT_TVA     = 6;
  const DEFAULT_ACOMPTE = 50; // CGV Solariscreen : acompte standard 50% à la commande

  const SELLER_SPLITS = {
    nicolas: { nicolas_pct: 18, yannick_pct: 5 },
    yannick: { nicolas_pct: 5,  yannick_pct: 18 },
  };

  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const r2  = (n) => Math.round((Number(n) || 0) * 100) / 100;

  function resolveSellerPcts(sellers) {
    sellers = sellers || {};
    const principal = sellers.principal || 'nicolas';
    if (principal === 'nicolas' || principal === 'yannick') {
      return Object.assign({ principal: principal }, SELLER_SPLITS[principal]);
    }
    return { principal: 'autre', nicolas_pct: num(sellers.nicolas_pct), yannick_pct: num(sellers.yannick_pct) };
  }

  // Réduction commerciale sur un poste : mode 'pct' (% du poste) ou 'eur' (montant fixe).
  // Plafonnée au montant du poste (une réduction ne peut pas rendre un poste négatif).
  function resolveRemiseAmount(remiseInput, base) {
    if (!remiseInput) return 0;
    const v = num(remiseInput.value);
    if (v <= 0 || base <= 0) return 0;
    const amount = remiseInput.mode === 'pct' ? base * (v / 100) : v;
    return Math.min(Math.max(amount, 0), base);
  }

  function computeDevis(input) {
    input = input || {};
    const items = input.items || [];
    const inst = input.installation || {};
    const extrasIn = input.extras || [];

    const tvaPct = num(input.tva_pct) || DEFAULT_TVA;
    const acomptePct = input.acompte_pct != null ? num(input.acompte_pct) : DEFAULT_ACOMPTE;
    const surplus = num(input.surplus_difficulte);

    // ── Catalogue ──
    let totalCatalog = 0, totalOpenings = 0;
    const itemLines = items.map(function (it) {
      const qty = num(it.quantite) || 1;
      const prix = num(it.prix_catalogue_ht);
      const sub = prix * qty;
      totalOpenings += qty;
      totalCatalog += sub;
      return { quantite: qty, prix_catalogue_ht: prix, sous_total: r2(sub) };
    });

    const supplierEstimate = totalCatalog * SUPPLIER_RATE;
    const totalMaterialGross = totalCatalog * MATERIAL_MARGIN;

    // ── Réduction commerciale sur le catalogue ──
    // Déduite de la commission du vendeur principal du devis (celui qui négocie la vente) ;
    // répartie au prorata des deux en mode "autre". N'affecte jamais le coût fournisseur réel.
    const remiseCatalogueAmount = resolveRemiseAmount(input.remise_catalogue, totalCatalog);
    const totalCatalogNet = r2(totalCatalog - remiseCatalogueAmount);

    // ── Commissions ──
    const sp = resolveSellerPcts(input.sellers);
    let nicolasGross = totalCatalog * (sp.nicolas_pct / 100);
    let yannickGross = totalCatalog * (sp.yannick_pct / 100);
    if (remiseCatalogueAmount > 0) {
      if (sp.principal === 'nicolas') nicolasGross -= remiseCatalogueAmount;
      else if (sp.principal === 'yannick') yannickGross -= remiseCatalogueAmount;
      else {
        const sumPct = sp.nicolas_pct + sp.yannick_pct;
        if (sumPct > 0) {
          nicolasGross -= remiseCatalogueAmount * (sp.nicolas_pct / sumPct);
          yannickGross -= remiseCatalogueAmount * (sp.yannick_pct / sumPct);
        }
      }
    }
    const nicolasNet = nicolasGross / NET_DIVISOR;
    const yannickNet = yannickGross / NET_DIVISOR;

    // ── Remise indicative (mode "autre" si commissions < 23%) ──
    let remise = { applicable: false, pct: 0, amount: 0 };
    if (sp.principal === 'autre') {
      const sumPct = sp.nicolas_pct + sp.yannick_pct;
      if (sumPct < 23) {
        const pct = 23 - sumPct;
        remise = { applicable: true, pct: r2(pct), amount: r2(totalCatalog * (pct / 100)) };
      }
    }

    // ── Installation ──
    const installGross = num(inst.install_gross);
    const tech1Gross = num(inst.tech1_gross);
    const tech2Gross = num(inst.tech2_gross);
    const toolsGross = num(inst.tools_gross);
    const installTotalRaw = installGross * num(inst.install_qty);
    const tech1TotalRaw = tech1Gross * num(inst.tech1_qty);
    const tech2TotalRaw = tech2Gross * num(inst.tech2_qty);
    const toolsTotalRaw = toolsGross * num(inst.tools_qty);
    const installBalanceOk =
      installGross <= 0 || Math.abs(tech1Gross + tech2Gross + toolsGross - installGross) <= 0.02;

    // ── Réduction commerciale sur l'installation (pose + tech1 + tech2, réparties ensemble) ──
    // La paie des techniciens n'est pas protégée : elle baisse proportionnellement, comme demandé.
    const remiseInstallationAmount = resolveRemiseAmount(input.remise_installation, installTotalRaw);
    const installFactor = installTotalRaw > 0 ? Math.max(0, installTotalRaw - remiseInstallationAmount) / installTotalRaw : 1;
    const installTotal = r2(installTotalRaw * installFactor);
    const tech1Total = r2(tech1TotalRaw * installFactor);
    const tech2Total = r2(tech2TotalRaw * installFactor);

    // ── Réduction commerciale sur l'outillage (poste indépendant) ──
    const remiseOutillageAmount = resolveRemiseAmount(input.remise_outillage, toolsTotalRaw);
    const toolsTotal = r2(toolsTotalRaw - remiseOutillageAmount);

    // ── Extras ──
    const extraLines = extrasIn.map(function (e) {
      const qty = num(e.qty) || 1;
      const unit = num(e.unit_price_ht);
      return { label: e.label || '', qty: qty, unit_price_ht: unit, total_ht: r2(qty * unit) };
    }).filter(function (e) { return e.label && e.unit_price_ht > 0; });
    const totalExtras = extraLines.reduce(function (s, e) { return s + e.total_ht; }, 0);

    // ── Totaux client ──
    // L'outillage n'est jamais facturé comme ligne séparée (il fait partie du forfait
    // "Installation et pose"), mais sa réduction doit tout de même se répercuter sur le
    // total payé par le client — sinon une "réduction outillage" n'aurait aucun effet réel.
    const totalHT = totalCatalogNet + installTotal + totalExtras + surplus - remiseOutillageAmount;
    const totalTVA = totalHT * (tvaPct / 100);
    const totalTTC = totalHT + totalTVA;
    const acompteMontant = totalTTC * (acomptePct / 100);
    const totalRemises = r2(remiseCatalogueAmount + remiseInstallationAmount + remiseOutillageAmount);

    return {
      total_catalog_ht: r2(totalCatalogNet),
      total_catalog_ht_brut: r2(totalCatalog),
      remise_catalogue: { mode: (input.remise_catalogue && input.remise_catalogue.mode) || 'eur', value: num(input.remise_catalogue && input.remise_catalogue.value), amount: r2(remiseCatalogueAmount) },
      remise_installation: { mode: (input.remise_installation && input.remise_installation.mode) || 'eur', value: num(input.remise_installation && input.remise_installation.value), amount: r2(remiseInstallationAmount) },
      remise_outillage: { mode: (input.remise_outillage && input.remise_outillage.mode) || 'eur', value: num(input.remise_outillage && input.remise_outillage.value), amount: r2(remiseOutillageAmount) },
      total_remises: totalRemises,
      total_openings: totalOpenings,
      supplier_estimate: r2(supplierEstimate),
      total_material_gross: r2(totalMaterialGross),
      item_lines: itemLines,
      seller_principal: sp.principal,
      nicolas_pct: sp.nicolas_pct, yannick_pct: sp.yannick_pct,
      nicolas_gross: r2(nicolasGross), nicolas_net: r2(nicolasNet),
      yannick_gross: r2(yannickGross), yannick_net: r2(yannickNet),
      remise: remise,
      install_total: r2(installTotal),
      install_total_brut: r2(installTotalRaw),
      tech1_total: r2(tech1Total), tech2_total: r2(tech2Total),
      tools_total: r2(toolsTotal), tools_total_brut: r2(toolsTotalRaw),
      total_installation_ht: r2(installTotal),
      install_balance_ok: installBalanceOk,
      total_extras_ht: r2(totalExtras),
      extra_lines: extraLines,
      total_ht: r2(totalHT),
      tva_pct: tvaPct,
      total_tva: r2(totalTVA),
      total_ttc: r2(totalTTC),
      acompte_pct: acomptePct,
      acompte_montant: r2(acompteMontant),
    };
  }

  function totalSurface(items) {
    return (items || []).reduce(function (s, i) {
      return s + (num(i.largeur) / 1000) * (num(i.hauteur) / 1000) * (num(i.quantite) || 1);
    }, 0);
  }

  window.SSCalc = {
    computeDevis: computeDevis, totalSurface: totalSurface, resolveSellerPcts: resolveSellerPcts,
    SUPPLIER_RATE: SUPPLIER_RATE, MATERIAL_MARGIN: MATERIAL_MARGIN, NET_DIVISOR: NET_DIVISOR,
  };
})();
