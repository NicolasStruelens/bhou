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
  const DEFAULT_ACOMPTE = 30;

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

    // ── Commissions ──
    const sp = resolveSellerPcts(input.sellers);
    const nicolasGross = totalCatalog * (sp.nicolas_pct / 100);
    const yannickGross = totalCatalog * (sp.yannick_pct / 100);
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
    const installTotal = installGross * num(inst.install_qty);
    const tech1Total = tech1Gross * num(inst.tech1_qty);
    const tech2Total = tech2Gross * num(inst.tech2_qty);
    const toolsTotal = toolsGross * num(inst.tools_qty);
    const installBalanceOk =
      installGross <= 0 || Math.abs(tech1Gross + tech2Gross + toolsGross - installGross) <= 0.02;

    // ── Extras ──
    const extraLines = extrasIn.map(function (e) {
      const qty = num(e.qty) || 1;
      const unit = num(e.unit_price_ht);
      return { label: e.label || '', qty: qty, unit_price_ht: unit, total_ht: r2(qty * unit) };
    }).filter(function (e) { return e.label && e.unit_price_ht > 0; });
    const totalExtras = extraLines.reduce(function (s, e) { return s + e.total_ht; }, 0);

    // ── Totaux client ──
    const totalHT = totalCatalog + installTotal + totalExtras + surplus;
    const totalTVA = totalHT * (tvaPct / 100);
    const totalTTC = totalHT + totalTVA;
    const acompteMontant = totalTTC * (acomptePct / 100);

    return {
      total_catalog_ht: r2(totalCatalog),
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
      tech1_total: r2(tech1Total), tech2_total: r2(tech2Total), tools_total: r2(toolsTotal),
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
