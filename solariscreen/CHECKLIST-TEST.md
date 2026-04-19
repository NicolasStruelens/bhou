# ✅ CHECKLIST DE TEST - SYSTÈME SOLARISCREEN

## 🧪 **TESTS À EFFECTUER AVANT MISE EN PRODUCTION**

### **1️⃣ TEST NAVIGATION (2 min)**
```
☐ Ouvrir index.html
☐ Cliquer "Calculateur Prix" → Arrive sur calculateur.html ✅
☐ Dans calculateur → Cliquer "Retour Dashboard" → Arrive sur dashboard.html ✅
☐ Dans dashboard → Cliquer "Nouveau Devis" → Arrive sur calculateur.html ✅
☐ Navigation fluide sans erreurs 404
```

### **2️⃣ TEST CRÉATION DEVIS (5 min)**
```
☐ Dashboard → [+ Nouveau Devis]
☐ Remplir client : Nom, prénom, adresse, téléphone
☐ Ajouter item : Type Screen, dimensions 1500×1200mm
☐ Upload photo test (drag & drop) → Preview s'affiche ✅
☐ Vérifier calculs automatiques (prix, TVA, total)
☐ Sauvegarder → Message succès + retour dashboard ✅
☐ Nouveau devis visible dans tableau dashboard ✅
```

### **3️⃣ TEST ÉDITION DEVIS (3 min)**
```
☐ Dashboard → Cliquer ✏️ sur devis créé
☐ Calculateur s'ouvre pré-rempli ✅
☐ Client, items, photos déjà chargés ✅
☐ Modifier une dimension → Recalculs automatiques ✅
☐ Ajouter une photo → Upload fonctionne ✅
☐ "Mettre à jour" → Retour dashboard ✅ 
☐ Modifications enregistrées dans tableau ✅
```

### **4️⃣ TEST GÉNÉRATION PDF (3 min)**
```
☐ Dashboard → Cliquer 📄 sur un devis
☐ Chargement "Génération PDF en cours..." ✅
☐ Téléchargement automatique PDF ✅
☐ Ouvrir PDF → Template SolariScreen exact ✅
☐ Vérifier en-tête : Logo + SysCore + Harol/Somfy ✅
☐ Vérifier données client correctes ✅
☐ Vérifier tableaux prix formatés ✅
☐ Vérifier photos intégrées si présentes ✅
☐ Vérifier calculs (HT, TVA, TVAC, acompte) ✅
```

### **5️⃣ TEST DUPLICATION (2 min)**
```
☐ Dashboard → Cliquer 📋 sur un devis
☐ Calculateur s'ouvre avec copie des données ✅
☐ Nouveau ID généré automatiquement ✅
☐ Modifier client → Changer nom ✅
☐ Sauvegarder → Nouveau devis créé ✅
☐ Dashboard montre 2 devis distincts ✅
```

### **6️⃣ TEST RESPONSIVE (3 min)**
```
☐ Réduire fenêtre navigateur → Layout s'adapte ✅
☐ Tester sur tablette/iPad → Interface optimisée ✅
☐ Tester sur smartphone → Navigation tactile fluide ✅
☐ Photos drag & drop fonctionne sur tactile ✅
☐ Boutons accessibles avec doigt ✅
```

### **7️⃣ TEST CALCULS MÉTIER (5 min)**
```
☐ Item 1500×1200mm → Surface 1.8m² calculée ✅
☐ Prix unitaire × quantité = sous-total ✅
☐ Marge vendeur 23% appliquée automatiquement ✅
☐ Remise client % → Recalcul correct ✅
☐ TVA 6% maison / 21% entreprise ✅
☐ Installation standard 280€ / tente solaire 560€ ✅
☐ Acompte 30% calculé sur total TTC ✅
```

### **8️⃣ TEST DONNÉES & PERSISTANCE (2 min)**
```
☐ Fermer navigateur → Rouvrir dashboard ✅
☐ Devis toujours présents (localStorage) ✅
☐ Photos conservées dans devis ✅
☐ Export JSON → Structure complète ✅
☐ Import JSON → Données restaurées ✅
```

---

## 🚨 **PROBLÈMES POTENTIELS & SOLUTIONS**

### **🔗 Liens cassés (404)**
```
❌ "Page non trouvée"
✅ Vérifier noms fichiers exacts :
   - calculateur.html (pas calculateur-prix.html)
   - dashboard.html (pas dashboard-devis.html)
```

### **📸 Photos ne s'affichent pas**
```
❌ Images ne se chargent pas
✅ Vérifier :
   - Format JPEG/PNG
   - Taille < 5MB
   - Navigateur moderne (Chrome/Firefox)
```

### **📄 PDF ne se génère pas**
```
❌ Erreur génération PDF
✅ Solutions :
   - Navigateur moderne requis
   - Popup/téléchargements autorisés
   - JavaScript activé
```

### **💾 Données perdues**
```
❌ Devis disparaissent
✅ Causes possibles :
   - Navigation privée (localStorage effacé)
   - Nettoyage cache navigateur
   - Domaine différent (localhost vs site)
```

---

## ✅ **VALIDATION FINALE**

### **🎯 CHECKLIST BUSINESS**
```
☐ Interface professionnelle ✅
☐ Workflow fluide équipe ✅
☐ Calculs conformes spécification ✅
☐ PDF identiques templates existants ✅
☐ Photos intégrées qualité pro ✅
☐ Responsive tous appareils ✅
☐ Performance rapide ✅
☐ Zéro bug identifié ✅
```

### **🏆 PRÊT PRODUCTION**
```
☐ Tests complets réussis
☐ Équipe formée utilisation
☐ Backup ancien système (sécurité)
☐ Communication clients (nouveau système)
☐ Go/No-Go décision prise
```

---

## 🚀 **MISE EN PRODUCTION**

### **📅 PLANNING RECOMMANDÉ**
```
Jour J-1 : Tests finaux + formation équipe
Jour J   : Déploiement + switch système
Jour J+1 : Vérification + support utilisateurs
Jour J+7 : Bilan première semaine
```

### **👥 FORMATION ÉQUIPE**
```
1. Demo complète workflow (10 min)
2. Test création devis réel (10 min)  
3. Gestion photos et PDF (5 min)
4. Questions/réponses (5 min)
```

---

**🎯 SYSTÈME VALIDÉ = GO PRODUCTION !** 
**TON BUSINESS SOLARISCREEN PRÊT POUR LE FUTUR ! 🚀**
