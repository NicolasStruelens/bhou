// 🏢 SYSTÈME PDF PROFESSIONNEL SOLARISCREEN
// Reproduction exacte des templates fournis

function generateProfessionalPDF(devisData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // ═══════════════════════════════════════════════════════════════
    // TEMPLATE SOLARISCREEN - REPRODUCTION EXACTE
    // ═══════════════════════════════════════════════════════════════
    
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    
    // ═══ EN-TÊTE AVEC LOGOS ═══
    function addHeader() {
        // Logo SolariScreen (gauche)
        doc.setFontSize(16);
        doc.setTextColor(51, 122, 183);
        doc.setFont('helvetica', 'bold');
        doc.text('SolariScreen', margin, 25);
        
        // Informations SysCore
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text('SysCore', margin, 35);
        doc.text('TVA : 1016 307 186', margin, 40);
        doc.text('Avenue de la Gare 60', margin, 45);
        doc.text('1401 Nivelles', margin, 50);
        doc.text('Compte bancaire : BE52 7320 7055 2368', margin, 55);
        doc.text('Site web : www.solariscreen.be', margin, 60);
        doc.text('Email : info@solariscreen.be / service@solariscreen.be', margin, 65);
        
        // Logo HAROL + SOMFY (droite)
        doc.setFontSize(12);
        doc.setTextColor(255, 165, 0);
        doc.setFont('helvetica', 'bold');
        doc.rect(pageWidth - 40, 20, 25, 12, 'S');
        doc.text('HAROL', pageWidth - 32, 28);
        
        doc.setTextColor(0, 150, 0);
        doc.rect(pageWidth - 40, 35, 25, 8, 'S');
        doc.text('SOMFY', pageWidth - 32, 40);
    }
    
    // ═══ TITRE PRINCIPAL ═══
    function addTitle() {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('Devis – Fourniture et installation de screen Harol CoolScreen8', margin, 85);
    }
    
    // ═══ INFORMATIONS CLIENT ═══ 
    function addClientInfo(client) {
        const clientY = 100;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Client
        doc.setFont('helvetica', 'bold');
        doc.text('Client :', margin, clientY);
        doc.setFont('helvetica', 'normal');
        doc.text(`${client.prenom || ''} ${client.nom || ''}`, margin + 15, clientY);
        
        // Adresse chantier
        doc.setFont('helvetica', 'bold');
        doc.text('Adresse chantier :', margin, clientY + 8);
        doc.setFont('helvetica', 'normal');
        const adresse = `${client.adresse?.rue || ''} ${client.adresse?.numero || ''}, ${client.adresse?.code_postal || ''} ${client.adresse?.ville || ''}`;
        doc.text(adresse, margin + 35, clientY + 8);
        
        // Mail
        doc.setFont('helvetica', 'bold');
        doc.text('Mail :', margin, clientY + 16);
        doc.setFont('helvetica', 'normal');
        doc.text(client.email || client.nom || '', margin + 12, clientY + 16);
        
        // Date et Référence (droite)
        doc.setFont('helvetica', 'bold');
        doc.text('Date :', pageWidth - 60, clientY);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date().toLocaleDateString('fr-BE'), pageWidth - 35, clientY);
        
        doc.setFont('helvetica', 'bold');
        doc.text('Référence :', pageWidth - 60, clientY + 8);
        doc.setFont('helvetica', 'normal');
        doc.text(devisData.id || 'N/A', pageWidth - 25, clientY + 8);
    }
    
    // ═══ SCHÉMA PRODUIT ═══
    function addProductDiagram(items) {
        const diagramY = 140;
        const diagramHeight = 60;
        
        // Cadre du schéma
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, diagramY, pageWidth - 2*margin, diagramHeight);
        
        // Titre du schéma
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`Item 1: ${items[0]?.type || 'Screen'} - ${items[0]?.emplacement || 'Sans emplacement'}`, 
                 pageWidth/2 - 30, diagramY + diagramHeight + 8);
        
        // Schéma simplifié avec dimensions 
        if (items[0]) {
            const item = items[0];
            // Rectangle représentant le screen
            doc.setFillColor(144, 238, 144);
            doc.rect(margin + 20, diagramY + 15, 60, 30, 'F');
            
            // Zone du moteur
            doc.setFillColor(255, 165, 0);
            doc.rect(margin + 85, diagramY + 20, 20, 20, 'F');
            
            // Dimensions
            doc.setFontSize(8);
            doc.text(`${item.largeur}mm`, margin + 45, diagramY + 55);
            doc.text(`${item.hauteur}mm`, margin + 5, diagramY + 35);
        }
    }
    
    // ═══ DESCRIPTION MATÉRIEL ═══
    function addDescription(items) {
        const descY = 220;
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('1. Description du matériel', margin, descY);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('- Description devis :', margin, descY + 10);
        
        if (items[0]) {
            const item = items[0];
            const description = `• ${item.type} - ${item.largeur} x ${item.hauteur} mm (${(item.largeur * item.hauteur / 1000000).toFixed(2)} m²) - ${item.vendeur} ${item.gamme} - ${item.prix_unitaire_ht} € HTVA`;
            doc.text(description, margin + 5, descY + 18);
        }
    }
    
    // ═══ TABLEAU PRIX ═══
    function addPriceTable(calculs) {
        const tableY = 255;
        const colWidths = [60, 40, 30, 40];
        const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]];
        
        // En-tête du tableau
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, tableY, colWidths.reduce((a,b) => a+b, 0), 8, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('2. Prix (TVA & %)', margin + 2, tableY + 6);
        
        // Ligne d'en-têtes
        const headerY = tableY + 15;
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, headerY, colWidths.reduce((a,b) => a+b, 0), 8, 'F');
        
        doc.setFontSize(8);
        doc.text('Poste', colX[0] + 2, headerY + 6);
        doc.text('Prix HT', colX[1] + 2, headerY + 6);
        doc.text('TVA 6%', colX[2] + 2, headerY + 6);
        doc.text('Total TVAC', colX[3] + 2, headerY + 6);
        
        // Lignes de données
        const dataY = headerY + 10;
        
        // Fourniture matériel
        doc.setFont('helvetica', 'normal');
        doc.text('Fourniture matériel', colX[0] + 2, dataY + 6);
        doc.text(`${calculs.total_ht.toFixed(2)} €`, colX[1] + 2, dataY + 6);
        doc.text(`${calculs.total_tva.toFixed(2)} €`, colX[2] + 2, dataY + 6);
        doc.text(`${calculs.total_ttc.toFixed(2)} €`, colX[3] + 2, dataY + 6);
        
        // Installation  
        doc.text('Installation', colX[0] + 2, dataY + 14);
        doc.text('0.00 €', colX[1] + 2, dataY + 14);
        doc.text('0.00 €', colX[2] + 2, dataY + 14);
        doc.text('0.00 €', colX[3] + 2, dataY + 14);
        
        // Total
        doc.setFont('helvetica', 'bold');
        doc.text('Total', colX[0] + 2, dataY + 22);
        doc.text(`${calculs.total_ht.toFixed(2)} €`, colX[1] + 2, dataY + 22);
        doc.text(`${calculs.total_tva.toFixed(2)} €`, colX[2] + 2, dataY + 22);
        doc.text(`${calculs.total_ttc.toFixed(2)} €`, colX[3] + 2, dataY + 22);
        
        // Bordures du tableau
        doc.setDrawColor(0, 0, 0);
        for (let i = 0; i <= colWidths.length; i++) {
            const x = i === 0 ? margin : colX[i-1] + colWidths[i-1];
            doc.line(x, headerY, x, dataY + 25);
        }
        doc.line(margin, headerY, margin + colWidths.reduce((a,b) => a+b, 0), headerY);
        doc.line(margin, dataY, margin + colWidths.reduce((a,b) => a+b, 0), dataY);
        doc.line(margin, dataY + 25, margin + colWidths.reduce((a,b) => a+b, 0), dataY + 25);
    }
    
    // ═══ ACOMPTE ═══
    function addAcompte(calculs) {
        const acompteY = 295;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('3. Acompte', margin, acompteY);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const acomptePct = calculs.acompte_pct || 30;
        const acompteMontant = (calculs.total_ttc * acomptePct / 100).toFixed(2);
        doc.text(`Un acompte de ${acomptePct} % est demandé à la commande.`, margin, acompteY + 8);
        doc.setFont('helvetica', 'bold');
        doc.text(`Montant de l'acompte : ${acompteMontant} € TVAC`, margin, acompteY + 16);
    }
    
    // ═══ CONDITIONS ═══
    function addConditions() {
        const condY = 325;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('4. Conditions', margin, condY);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const conditions = [
            '- Offre valable 2 mois',
            '- Délais de livraison selon disponibilité Harol (+ - 4 semaines)',
            '- Paiement : acompte de 30 % à la commande, soldé à la livraison',
            '- Installation prévue par SolariScreen'
        ];
        
        conditions.forEach((condition, index) => {
            doc.text(condition, margin, condY + 12 + (index * 6));
        });
        
        // Signature du client
        doc.text('Signature du client :', pageWidth - 80, condY + 40);
    }
    
    // ═══ GÉNÉRATION COMPLÈTE ═══
    addHeader();
    addTitle();
    addClientInfo(devisData.client || {});
    addProductDiagram(devisData.items || []);
    addDescription(devisData.items || []);
    addPriceTable(devisData.calculs || {});
    addAcompte(devisData.calculs || {});
    addConditions();
    
    return doc;
}

// Fonction d'export PDF intégrée
function exportPDF() {
    try {
        // Récupérer toutes les données du devis
        const devisData = gatherAllData();
        
        if (!devisData.client?.nom) {
            alert('⚠️ Veuillez renseigner au moins le nom du client avant de générer le PDF.');
            return;
        }
        
        // Générer le PDF avec le template professionnel
        const doc = generateProfessionalPDF(devisData);
        
        // Nom du fichier
        const fileName = `Devis_SolariScreen_${devisData.id}_${devisData.client.nom.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        
        // Téléchargement
        doc.save(fileName);
        
        console.log('✅ PDF généré avec succès:', fileName);
        
    } catch (error) {
        console.error('❌ Erreur lors de la génération PDF:', error);
        alert('Erreur lors de la génération du PDF: ' + error.message);
    }
}

console.log('📄 Système PDF SolariScreen Professional chargé');
