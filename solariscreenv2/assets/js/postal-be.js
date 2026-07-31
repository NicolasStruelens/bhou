/* ═══════════════════════════════════════════════════════════════════════════════════════════
   CODES POSTAUX BELGES — saisie assistée dans les deux sens
   ═══════════════════════════════════════════════════════════════════════════════════════════
   Nicolas tape « 1440 » → la ville se remplit toute seule ; il tape « Braine » → le code postal
   se remplit. Les 1187 codes postaux belges sont EMBARQUÉS dans ce fichier : aucun appel réseau,
   donc ça marche aussi en Mode Terrain sans réseau, chez le client, dans une cave.

   Sources des données : Statbel / OpenDataSoft « georef-belgium-postal-codes » (autorité pour la
   commune, la casse et la langue officielle) + jief/zipcode-belgium (alias de sous-localités).

   ⚠️ RÈGLE DE LANGUE : chaque localité porte son nom dans SA langue officielle. Un client de Gand
   reçoit « 9000 Gent », pas « 9000 Gand » — c'est ce que veut bpost et ce qu'attend le client.
   Bruxelles (bilingue) est en français. Les exonymes (Gand, Anvers, Luik…) restent cherchables.

   Format d'une ligne : CP;localité principale;province;alias1,alias2,…
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var RAW = `1000;Bruxelles;BXL;Brussel,Elsene,Ixelles,Saint-Josse-ten-Noode,Sint-Joost-ten-Node
1005;Bruxelles;BXL;Brussel
1006;Bruxelles;BXL;Brussel
1007;Bruxelles;BXL;Brussel
1008;Bruxelles;BXL;Brussel
1009;Bruxelles;BXL;Brussel
1011;Bruxelles;BXL;Brussel
1012;Bruxelles;BXL;Brussel
1020;Bruxelles;BXL;Brussel,Laeken
1030;Schaerbeek;BXL;Schaarbeek
1031;Schaerbeek;BXL;Schaarbeek
1033;Schaerbeek;BXL;Schaarbeek
1035;Schaerbeek;BXL;Schaarbeek
1040;Etterbeek;BXL;Brussel,Bruxelles
1041;Bruxelles;BXL;Brussel
1043;Schaerbeek;BXL;Schaarbeek
1044;Schaerbeek;BXL;Schaarbeek
1046;Evere;BXL;
1047;Ixelles;BXL;Elsene
1048;Bruxelles;BXL;Brussel
1049;Evere;BXL;
1050;Ixelles;BXL;Elsene,Saint-Gilles,Sint-Gillis
1060;Saint-Gilles;BXL;Sint-Gillis
1070;Anderlecht;BXL;
1080;Molenbeek-Saint-Jean;BXL;Sint-Jans-Molenbeek
1081;Koekelberg;BXL;
1082;Berchem-Sainte-Agathe;BXL;Sint-Agatha-Berchem
1083;Ganshoren;BXL;
1090;Jette;BXL;
1099;Bruxelles;BXL;Brussel
1105;Bruxelles;BXL;Brussel
1110;Bruxelles;BXL;Brussel
1120;Bruxelles;BXL;Brussel,Neder-Over-Heembeek
1130;Bruxelles;BXL;Brussel,Haren
1140;Evere;BXL;
1150;Woluwe-Saint-Pierre;BXL;Sint-Pieters-Woluwe
1160;Auderghem;BXL;Oudergem
1170;Watermael-Boitsfort;BXL;Watermaal-Bosvoorde
1180;Uccle;BXL;Ukkel
1190;Forest;BXL;Vorst
1200;Woluwe-Saint-Lambert;BXL;Sint-Lambrechts-Woluwe
1210;Saint-Josse-ten-Noode;BXL;Sint-Joost-ten-Node
1212;Saint-Josse-ten-Noode;BXL;Sint-Joost-ten-Node
1300;Wavre;BW;Limal,Waver
1301;Wavre;BW;Bierges,Waver
1310;La Hulpe;BW;Terhulpen
1315;Incourt;BW;Glimes,Opprebais,Piètrebais,Roux-Miroir
1320;Beauvechain;BW;Bevekom,Hamme-Mille,L'ecluse,Nodebais,Tourinnes-la-Grosse
1325;Chaumont-Gistoux;BW;Bonlez,Corroy-le-Grand,Dion-Valmont,Longueville
1330;Rixensart;BW;
1331;Rixensart;BW;Rosières
1332;Rixensart;BW;Genval
1340;Ottignies-Louvain-la-Neuve;BW;Ottignies
1341;Ottignies-Louvain-la-Neuve;BW;Céroux-Mousty
1342;Ottignies-Louvain-la-Neuve;BW;Limelette
1348;Louvain-la-Neuve;BW;Mont-Saint-Guibert,Ottignies,Ottignies-Louvain-la-Neuve
1350;Orp-Jauche;BW;Enines,Folx-les-Caves,Jandrain-Jandrenouille,Jauche,Marilles,Noduwez,Orp-le-Grand
1357;Hélécine;BW;Linsmeau,Neerheylissem,Opheylissem
1360;Perwez;BW;Malèves-Sainte-Marie-Wastines,Orbais,Perwijs,Thorembais-Saint-Trond,Thorembais-les-Béguines
1367;Ramillies;BW;Autre-Eglise,Bomal,Geest-Gérompont-Petit-Rosière,Grand-Rosière-Hottomont,Gérompont,Huppaye,Mont-Saint-André
1370;Jodoigne;BW;Dongelberg,Geldenaken,Jauchelette,Jodoigne-Souveraine,Lathuy,Mélin,Piétrain,Saint-Jean-Geest,Saint-Remy-Geest,Zétrud-Lumay
1380;Lasne;BW;Couture-Saint-Germain,Lasne-Chapelle-Saint-Lambert,Maransart,Ohain,Plancenoit
1390;Grez-Doiceau;BW;Archennes,Biez,Bossut-Gottechain,Graven,Nethen
1400;Nivelles;BW;Monstreux,Nijvel
1401;Nivelles;BW;Baulers,Nijvel
1402;Nivelles;BW;Nijvel,Thines
1404;Nivelles;BW;Bornival,Nijvel
1410;Waterloo;BW;
1420;Braine-l'Alleud;BW;Eigenbrakel
1421;Braine-l'Alleud;BW;Eigenbrakel,Ophain-Bois-Seigneur-Isaac
1428;Braine-l'Alleud;BW;Eigenbrakel,Lillois-Witterzée
1430;Rebecq;BW;Bierghes,Quenast,Rebecq-Rognon
1435;Mont-Saint-Guibert;BW;Corbais,Hévillers
1440;Braine-le-Château;BW;Kasteelbrakel,Wauthier-Braine
1450;Chastre;BW;Chastre-Villeroux-Blanmont,Cortil-Noirmont,Gentinnes,Saint-Géry
1457;Walhain;BW;Nil-Saint-Vincent-Saint-Martin,Tourinnes-Saint-Lambert,Walhain-Saint-Paul
1460;Ittre;BW;Itter,Virginal-Samme
1461;Ittre;BW;Haut-Ittre,Itter
1470;Genappe;BW;Baisy-Thy,Bousval,Genepiën
1471;Genappe;BW;Genepiën,Loupoigne
1472;Genappe;BW;Genepiën,Vieux-Genappe
1473;Genappe;BW;Genepiën,Glabais
1474;Genappe;BW;Genepiën,Ways
1476;Genappe;BW;Genepiën,Houtain-le-Val
1480;Tubize;BW;Clabecq,Oisquercq,Saintes,Tubeke
1490;Court-Saint-Étienne;BW;
1495;Villers-la-Ville;BW;Marbais,Mellery,Sart-Dames-Avelines,Tilly
1500;Halle;BF;Hal
1501;Halle;BF;Buizingen,Hal
1502;Halle;BF;Hal,Lembeek
1540;Pajottegem;BF;Herfelingen,Herne
1541;Pajottegem;BF;Sint-Pieters-Kapelle
1547;Bever;BF;Biévène
1560;Hoeilaart;BF;
1570;Pajottegem;BF;Galmaarden,Tollembeek,Vollezele
1600;Sint-Pieters-Leeuw;BF;Oudenaken,Sint-Laureins-Berchem
1601;Sint-Pieters-Leeuw;BF;Ruisbroek
1602;Sint-Pieters-Leeuw;BF;Vlezenbeek
1620;Drogenbos;BF;
1630;Linkebeek;BF;
1640;Sint-Genesius-Rode;BF;Rhode-Saint-Genèse
1650;Beersel;BF;
1651;Beersel;BF;Lot
1652;Beersel;BF;Alsemberg
1653;Beersel;BF;Dworp
1654;Beersel;BF;Huizingen
1670;Pepingen;BF;Bogaarden,Heikruis
1671;Pepingen;BF;Elingen
1673;Pepingen;BF;Beert
1674;Pepingen;BF;Bellingen
1700;Dilbeek;BF;Sint-Martens-Bodegem,Sint-Ulriks-Kapelle
1701;Dilbeek;BF;Itterbeek
1702;Dilbeek;BF;Groot-Bijgaarden
1703;Dilbeek;BF;Schepdaal
1730;Asse;BF;Bekkerzeel,Kobbegem,Mollem
1731;Asse;BF;Relegem,Zellik
1733;Asse;BF;
1740;Ternat;BF;
1741;Ternat;BF;Wambeek
1742;Ternat;BF;Sint-Katherina-Lombeek
1745;Opwijk;BF;Mazenzele
1750;Lennik;BF;Gaasbeek,Sint-Kwintens-Lennik,Sint-Martens-Lennik
1755;Pajottegem;BF;Gooik,Kester,Leerbeek,Oetingen
1760;Roosdaal;BF;Onze-Lieve-Vrouw-Lombeek,Pamel,Strijtem
1761;Roosdaal;BF;Borchtlombeek
1770;Liedekerke;BF;
1780;Wemmel;BF;
1785;Merchtem;BF;Brussegem,Hamme
1790;Affligem;BF;Essene,Hekelgem,Teralfene
1800;Vilvoorde;BF;Peutie,Vilvorde
1804;Vilvoorde;BF;Vilvorde
1820;Steenokkerzeel;BF;Melsbroek,Perk
1830;Machelen;BF;
1831;Machelen;BF;Diegem
1840;Londerzeel;BF;Malderen,Steenhuffel
1850;Grimbergen;BF;
1851;Grimbergen;BF;Humbeek
1852;Grimbergen;BF;Beigem
1853;Grimbergen;BF;Strombeek-Bever
1860;Meise;BF;
1861;Meise;BF;Wolvertem
1880;Kapelle-op-den-Bos;BF;Nieuwenrode,Ramsdonk
1910;Kampenhout;BF;Berg,Buken,Nederokkerzeel
1930;Zaventem;BF;Nossegem
1931;Machelen;BF;Diegem
1932;Zaventem;BF;Sint-Stevens-Woluwe
1933;Zaventem;BF;Sterrebeek
1934;Machelen;BF;Diegem
1935;Zaventem;BF;
1950;Kraainem;BF;
1970;Wezembeek-Oppem;BF;
1980;Zemst;BF;Eppegem
1981;Zemst;BF;Hofstade
1982;Zemst;BF;Elewijt,Weerde
2000;Antwerpen;AN;Anvers
2018;Antwerpen;AN;Anvers
2020;Antwerpen;AN;Anvers
2030;Antwerpen;AN;Anvers
2040;Antwerpen;AN;Anvers,Berendrecht,Berendrecht-Zandvliet-Lillo,Lillo,Zandvliet
2050;Antwerpen;AN;Anvers
2060;Antwerpen;AN;Anvers
2070;Beveren-Kruibeke-Zwijndrecht;FE;Burcht,Zwijndrecht
2099;Antwerpen;AN;Anvers
2100;Antwerpen;AN;Anvers,Deurne
2110;Wijnegem;AN;
2140;Antwerpen;AN;Anvers,Borgerhout
2150;Antwerpen;AN;Anvers,Borsbeek
2160;Wommelgem;AN;
2170;Antwerpen;AN;Anvers,Merksem
2180;Antwerpen;AN;Anvers,Ekeren
2200;Herentals;AN;Morkhoven,Noorderwijk
2220;Heist-op-den-Berg;AN;Hallaar
2221;Heist-op-den-Berg;AN;Booischot
2222;Heist-op-den-Berg;AN;Itegem,Wiekevorst
2223;Heist-op-den-Berg;AN;Schriek
2230;Herselt;AN;Ramsel
2235;Hulshout;AN;Houtvenne,Westmeerbeek
2240;Zandhoven;AN;Massenhoven,Viersel
2242;Zandhoven;AN;Pulderbos
2243;Zandhoven;AN;Pulle
2250;Olen;AN;
2260;Westerlo;AN;Oevel,Tongerlo,Zoerle-Parwijs
2270;Herenthout;AN;
2275;Lille;AN;Gierle,Poederlee,Wechelderzande
2280;Grobbendonk;AN;
2288;Grobbendonk;AN;Bouwel
2290;Vorselaar;AN;
2300;Turnhout;AN;
2310;Rijkevorsel;AN;
2320;Hoogstraten;AN;
2321;Hoogstraten;AN;Meer
2322;Minderhout;AN;
2323;Hoogstraten;AN;Wortel
2328;Hoogstraten;AN;Meerle
2330;Merksplas;AN;
2340;Beerse;AN;Vlimmeren
2350;Vosselaar;AN;
2360;Oud-Turnhout;AN;
2370;Arendonk;AN;
2380;Ravels;AN;
2381;Ravels;AN;Weelde
2382;Ravels;AN;Poppel
2387;Baarle-Hertog;AN;Baerle-Duc
2390;Malle;AN;Oostmalle,Westmalle
2400;Dessel;AN;Mol
2430;Laakdal;AN;Eindhout,Vorst
2431;Laakdal;AN;Varendonk,Veerle
2440;Geel;AN;
2450;Meerhout;AN;
2460;Kasterlee;AN;Lichtaart,Tielen
2470;Retie;AN;
2480;Dessel;AN;
2490;Balen;AN;
2491;Balen;AN;Olmen
2500;Lier;AN;Koningshooikt,Lierre
2520;Ranst;AN;Broechem,Emblem,Oelegem
2530;Boechout;AN;
2531;Boechout;AN;Vremde
2540;Hove;AN;
2547;Lint;AN;
2550;Kontich;AN;Waarloos
2560;Nijlen;AN;Bevel,Kessel
2570;Duffel;AN;
2580;Putte;AN;Beerzel
2590;Berlaar;AN;Gestel
2600;Antwerpen;AN;Anvers,Berchem
2610;Antwerpen;AN;Anvers,Wilrijk
2620;Hemiksem;AN;
2627;Schelle;AN;
2630;Aartselaar;AN;
2640;Mortsel;AN;
2650;Edegem;AN;
2660;Antwerpen;AN;Anvers,Hoboken
2800;Mechelen;AN;Malines,Walem
2801;Mechelen;AN;Heffen,Malines
2811;Mechelen;AN;Hombeek,Leest,Malines
2812;Mechelen;AN;Malines,Muizen
2820;Bonheiden;AN;Rijmenam
2830;Willebroek;AN;Blaasveld,Heindonk,Tisselt
2840;Rumst;AN;Reet,Terhagen
2845;Niel;AN;
2850;Boom;AN;
2860;Sint-Katelijne-Waver;AN;
2861;Sint-Katelijne-Waver;AN;Onze-Lieve-Vrouw-Waver
2870;Puurs-Sint-Amands;AN;Breendonk,Liezele,Puurs,Ruisbroek
2880;Bornem;AN;Hingene,Mariekerke,Weert
2890;Puurs-Sint-Amands;AN;Lippelo,Oppuurs,Sint-Amands
2900;Schoten;AN;
2910;Essen;AN;
2920;Kalmthout;AN;
2930;Brasschaat;AN;
2940;Stabroek;AN;Hoevenen
2950;Kapellen;AN;
2960;Brecht;AN;Sint-Job-In-'t-Goor,Sint-Lenaarts
2970;Schilde;AN;'s Gravenwezel
2980;Zoersel;AN;Halle
2990;Wuustwezel;AN;Loenhout
3000;Leuven;BF;Heverlee,Louvain,Löwen
3001;Leuven;BF;Heverlee,Louvain,Löwen
3010;Leuven;BF;Kessel Lo,Louvain,Löwen
3012;Leuven;BF;Louvain,Löwen,Wilsele
3018;Leuven;BF;Louvain,Löwen,Wijgmaal,Wilsele
3020;Herent;BF;Veltem-Beisem,Winksele
3040;Huldenberg;BF;Loonbeek,Neerijse,Ottenburg,Sint-Agatha-Rode
3050;Oud-Heverlee;BF;
3051;Oud-Heverlee;BF;Sint-Joris-Weert
3052;Oud-Heverlee;BF;Blanden
3053;Oud-Heverlee;BF;Haasrode
3054;Oud-Heverlee;BF;Vaalbeek
3060;Bertem;BF;Korbeek-Dijle
3061;Bertem;BF;Leefdaal
3070;Kortenberg;BF;
3071;Kortenberg;BF;Erps-Kwerps
3078;Kortenberg;BF;Everberg,Meerbeek
3080;Tervuren;BF;Duisburg,Vossem
3090;Overijse;BF;
3110;Rotselaar;BF;
3111;Rotselaar;BF;Wezemaal
3118;Rotselaar;BF;Werchter
3120;Tremelo;BF;
3128;Tremelo;BF;Baal
3130;Begijnendijk;BF;Betekom
3140;Keerbergen;BF;
3150;Haacht;BF;Tildonk,Wespelaar
3190;Boortmeerbeek;BF;
3191;Boortmeerbeek;BF;Hever
3200;Aarschot;BF;Gelrode
3201;Aarschot;BF;Langdorp
3202;Aarschot;BF;Rillaar
3210;Lubbeek;BF;Linden
3211;Lubbeek;BF;Binkom
3212;Lubbeek;BF;Pellenberg
3220;Holsbeek;BF;Kortrijk-Dutsel,Sint-Pieters-Rode
3221;Holsbeek;BF;Nieuwrode
3270;Scherpenheuvel-Zichem;BF;Montaigu-Zichem,Scherpenheuvel
3271;Scherpenheuvel-Zichem;BF;Averbode,Montaigu-Zichem,Zichem
3272;Scherpenheuvel-Zichem;BF;Messelbroek,Montaigu-Zichem,Testelt
3290;Diest;BF;Deurne,Schaffen,Webbekom
3293;Diest;BF;Kaggevinne
3294;Diest;BF;Molenstede
3300;Tienen;BF;Bost,Goetsenhoven,Hakendover,Kumtich,Oorbeek,Oplinter,Sint-Margriete-Houtem,Tirlemont,Vissenaken
3320;Hoegaarden;BF;Meldert
3321;Hoegaarden;BF;Outgaarden
3350;Linter;BF;Drieslinter,Melkwezer,Neerhespen,Neerlinter,Orsmaal-Gussenhoven,Overhespen,Wommersom
3360;Bierbeek;BF;Korbeek-Lo,Lovenjoel,Opvelp
3370;Boutersem;BF;Kerkom,Neervelp,Roosbeek,Vertrijk,Willebringen
3380;Glabbeek;BF;Bunsbeek,Glabbeek-Zuurbemde
3381;Glabbeek;BF;Kapellen
3384;Glabbeek;BF;Attenrode
3390;Tielt-Winge;BF;Houwaart,Sint-Joris-Winge,Tielt
3391;Tielt-Winge;BF;Meensel-Kiezegem
3400;Landen;BF;Eliksem,Ezemaal,Laar,Neerwinden,Overwinden,Rumsdorp,Wange
3401;Landen;BF;Waasmont,Walsbets,Walshoutem,Wezeren
3404;Landen;BF;Attenhoven,Neerlanden
3440;Zoutleeuw;BF;Budingen,Dormaal,Halle-Booienhoven,Helen-Bos,Léau
3450;Geetbets;BF;Grazen
3454;Geetbets;BF;Rummen
3460;Bekkevoort;BF;Assent
3461;Bekkevoort;BF;Molenbeek-Wersbeek
3470;Kortenaken;BF;Ransberg,Sint-Margriete-Houtem
3471;Kortenaken;BF;Hoeleden
3472;Kortenaken;BF;Kersbeek-Miskom
3473;Kortenaken;BF;Waanrode
3500;Hasselt;LI;Sint-Lambrechts-Herk
3501;Hasselt;LI;Wimmertingen
3510;Hasselt;LI;Kermt,Spalbeek
3511;Hasselt;LI;Kuringen,Stokrooie
3512;Hasselt;LI;Stevoort
3520;Zonhoven;LI;
3530;Houthalen-Helchteren;LI;Helchteren,Houthalen
3540;Herk-de-Stad;LI;Berbroek,Donk,Herck-la-Ville,Schulen
3545;Halen;LI;Loksbergen,Zelem
3550;Heusden-Zolder;LI;Heusden,Zolder
3560;Lummen;LI;Linkhout,Meldert
3570;Alken;LI;
3580;Beringen;LI;
3581;Beringen;LI;Beverlo
3582;Beringen;LI;Koersel
3583;Beringen;LI;Paal
3590;Diepenbeek;LI;
3600;Genk;LI;
3620;Lanaken;LI;Gellik,Neerharen,Veldwezelt
3621;Lanaken;LI;Rekem
3630;Maasmechelen;LI;Eisden,Leut,Mechelen-aan-de-Maas,Meeswijk,Opgrimbie,Vucht
3631;Maasmechelen;LI;Boorsem,Uikhoven
3640;Kinrooi;LI;Kessenich,Molenbeersel,Ophoven
3650;Dilsen-Stokkem;LI;Dilsen,Elen,Lanklaar,Rotem,Stokkem
3660;Oudsbergen;LI;Opglabbeek
3665;As;LI;
3668;As;LI;Niel-bij-As
3670;Oudsbergen;LI;Ellikom,Gruitrode,Meeuwen,Meeuwen-Gruitrode,Neerglabbeek,Wijshagen
3680;Maaseik;LI;Neeroeteren,Opoeteren
3690;Zutendaal;LI;
3700;Tongeren-Borgloon;LI;'s Herenelderen,Berg,Diets-Heur,Haren,Henis,Kolmont,Koninksem,Lauw,Mal,Neerrepen,Nerem,Overrepen,Piringen,Riksingen,Rutten,Sluizen,Tongeren,Vreren,Widooie
3717;Herstappe;LI;
3720;Hasselt;LI;Kortessem
3721;Hasselt;LI;Vliermaalroot
3722;Hasselt;LI;Wintershoven
3723;Hasselt;LI;Guigoven
3724;Hasselt;LI;Vliermaal
3730;Bilzen-Hoeselt;LI;Hoeselt,Romershoven,Sint-Huibrechts-Hern,Werm
3732;Bilzen-Hoeselt;LI;Schalkhoven
3740;Bilzen-Hoeselt;LI;Beverst,Bilzen,Eigenbilzen,Grote-Spouwen,Hees,Kleine-Spouwen,Mopertingen,Munsterbilzen,Rijkhoven,Rosmeer,Waltwilder
3742;Bilzen-Hoeselt;LI;Martenslinde
3746;Bilzen-Hoeselt;LI;Hoelbeek,Waltwilder
3770;Riemst;LI;Genoelselderen,Herderen,Kanne,Membruggen,Millen,Val-Meer,Vlijtingen,Vroenhoven,Zichen-Zussen-Bolder
3790;Voeren;LI;Fouron-Saint-Martin,Fourons,Moelingen,Mouland,Sint-Martens-Voeren
3791;Voeren;LI;Fourons,Remersdaal
3792;Voeren;LI;Fouron-Saint-Pierre,Fourons,Sint-Pieters-Voeren
3793;Voeren;LI;Fourons,Teuven
3798;Voeren;LI;'s-Gravenvoeren,Fouron-le-Comte,Fourons
3800;Sint-Truiden;LI;Aalst,Brustem,Engelmanshoven,Gelinden,Groot-Gelmen,Halmaal,Kerkom-bij-Sint-Truiden,Ordingen,Saint-Trond,Zepperen
3803;Sint-Truiden;LI;Duras,Gorsem,Runkelen,Saint-Trond,Wilderen
3806;Sint-Truiden;LI;Saint-Trond,Velm
3830;Wellen;LI;Berlingen
3831;Wellen;LI;Herten
3832;Wellen;LI;Ulbeek
3840;Tongeren-Borgloon;LI;Bommershoven,Borgloon,Broekom,Gors-Opleeuw,Gotem,Groot-Loon,Haren,Hendrieken,Hoepertingen,Jesseren,Kerniel,Kolmont,Kuttekoven,Rijkel,Voort
3850;Nieuwerkerken;LI;Binderveld,Kozen,Wijer
3870;Heers;LI;Batsheers,Bovelingen,Heks,Horpmaal,Klein-Gelmen,Mechelen-Bovelingen,Mettekoven,Opheers,Rukkelingen-Loon,Vechmaal,Veulen
3890;Gingelom;LI;Boekhout,Borlo,Jeuk,Kortijs,Montenaken,Niel-bij-Sint-Truiden,Vorsen
3891;Gingelom;LI;Borlo,Buvingen,Mielen-Boven-Aalst,Muizen
3900;Pelt;LI;Overpelt
3910;Pelt;LI;Neerpelt,Sint-Huibrechts-Lille
3920;Lommel;LI;
3930;Hamont-Achel;LI;Achel,Hamont
3940;Hechtel-Eksel;LI;Hechtel
3941;Hechtel-Eksel;LI;Eksel
3945;Tessenderlo-Ham;LI;Ham,Kwaadmechelen,Oostham
3950;Bocholt;LI;Kaulille,Reppel
3960;Bree;LI;Beek,Gerdingen,Opitter,Tongerlo
3970;Leopoldsburg;LI;Bourg-Léopold
3971;Leopoldsburg;LI;Bourg-Léopold,Heppen
3980;Tessenderlo-Ham;LI;Tessenderlo
3990;Peer;LI;Grote-Brogel,Kleine-Brogel,Wijchmaal
4000;Liège;LG;Angleur,Glain,Luik,Lüttich,Rocourt
4020;Liège;LG;Bressoux,Jupille-sur-Meuse,Luik,Lüttich,Wandre
4030;Liège;LG;Grivegnee,Luik,Lüttich
4031;Liège;LG;Angleur,Luik,Lüttich
4032;Liège;LG;Chênee,Luik,Lüttich
4040;Herstal;LG;
4041;Herstal;LG;Milmort,Vottem
4042;Herstal;LG;Liers
4050;Chaudfontaine;LG;
4051;Chaudfontaine;LG;Vaux-sous-Chèvremont
4052;Chaudfontaine;LG;Beaufays
4053;Chaudfontaine;LG;Embourg
4099;Awans;LG;
4100;Seraing;LG;Boncelles
4101;Seraing;LG;Jemeppe,Jemeppe-sur-Meuse
4102;Seraing;LG;Ougrée
4120;Neupré;LG;Ehein,Rotheux-Rimière
4121;Neupré;LG;Neuville-en-Condroz
4122;Neupré;LG;Plainevaux
4130;Esneux;LG;Tilff
4140;Sprimont;LG;Dolembreux,Gomzé-Andoumont,Rouvreux
4141;Sprimont;LG;Louveigné
4160;Anthisnes;LG;
4161;Anthisnes;LG;Villers-aux-Tours
4162;Anthisnes;LG;Hody
4163;Anthisnes;LG;Tavier
4170;Comblain-au-Pont;LG;
4171;Comblain-au-Pont;LG;Poulseur
4180;Hamoir;LG;Comblain-Fairon,Comblain-la-Tour
4181;Hamoir;LG;Filot
4190;Ferrières;LG;My,Vieuxville,Werbomont,Xhoris
4210;Burdinne;LG;Hannêche,Lamontzée,Marneffe,Oteppe
4217;Héron;LG;Lavoir,Waret-L'evêque
4218;Héron;LG;Couthuin
4219;Wasseiges;LG;Acosse,Ambresin,Meeffe
4250;Geer;LG;Boëlhe,Hollogne-sur-Geer,Lens-Saint-Servais
4252;Geer;LG;Omal
4253;Geer;LG;Darion
4254;Geer;LG;Ligney
4257;Berloz;LG;Corswarem
4260;Braives;LG;Avennes,Ciplet,Fallais,Fumal,Ville-en-Hesbaye
4261;Braives;LG;Latinne
4263;Braives;LG;Tourinne
4280;Hannut;LG;Abolens,Avernas-le-Bauduin,Avin,Bertrée,Blehen,Cras-Avernas,Crehen,Grand-Hallet,Hannuit,Lens-Saint-Remy,Merdorp,Moxhe,Petit-Hallet,Poucet,Thisnes,Trognée,Villers-le-Peuplier,Wansin
4287;Lincent;LG;Lijsem,Pellaines,Racour
4300;Waremme;LG;Bettincourt,Bleret,Borgworm,Bovenistier,Grand-Axhe,Lantremange,Oleye
4317;Faimes;LG;Aineffe,Borlez,Celles,Les Waleffes,Viemme
4340;Awans;LG;Fooz,Othée,Villers-L'evêque
4342;Awans;LG;Hognoul
4347;Fexhe-le-Haut-Clocher;LG;Freloux,Noville,Roloux,Voroux-Goreux
4350;Remicourt;LG;Lamine,Momalle,Pousset
4351;Remicourt;LG;Hodeige
4357;Donceel;LG;Haneffe,Jeneffe,Limont
4360;Oreye;LG;Bergilers,Grandville,Lens-sur-Geer,Oerle,Otrange
4367;Crisnée;LG;Fize-le-Marsal,Kemexhe,Odeur,Thys
4400;Flémalle;LG;Awirs,Chokier,Flémalle-Grande,Flémalle-Haute,Ivoz-Ramet,Mons-lez-Liège
4420;Saint-Nicolas;LG;Montegnée,Tilleur
4430;Ans;LG;
4431;Ans;LG;Loncin
4432;Ans;LG;Alleur,Xhendremael
4450;Juprelle;LG;Lantin,Slins,Villers-Saint-Siméon
4451;Juprelle;LG;Voroux-lez-Liers
4452;Juprelle;LG;Paifve,Wihogne
4453;Juprelle;LG;Villers-Saint-Siméon
4458;Juprelle;LG;Fexhe-Slins
4460;Grâce-Hollogne;LG;Bierset,Grâce-Berleur,Hollogne-aux-Pierres,Horion-Hozémont,Velroux
4470;Saint-Georges-sur-Meuse;LG;
4480;Engis;LG;Clermont-sous-Huy,Ehein,Hermalle-sous-Huy
4500;Huy;LG;Ben-Ahin,Hoei,Tihange
4520;Wanze;LG;Antheit,Bas-Oha,Huccorgne,Moha,Vinalmont
4530;Villers-le-Bouillet;LG;Fize-Fontaine,Vaux-et-Borset,Vieux-Waleffe,Warnant-Dreye
4537;Verlaine;LG;Bodegnée,Chapon-Seraing,Seraing-le-Château
4540;Amay;LG;Ampsin,Flône,Jehay,Ombret
4550;Nandrin;LG;Saint-Séverin,Villers-le-Temple,Yernée-Fraineux
4557;Tinlot;LG;Abée,Fraiture,Ramelot,Seny,Soheit-Tinlot
4560;Clavier;LG;Bois-et-Borsu,Les Avins,Ocquier,Pailhe,Terwagne
4570;Marchin;LG;Vyle-et-Tharoul
4577;Modave;LG;Outrelouxhe,Strée-lez-Huy,Vierset-Barse
4590;Ouffet;LG;Ellemelle,Warzée
4600;Visé;LG;Lanaye,Lixhe,Richelle,Wezet
4601;Visé;LG;Argenteau,Wezet
4602;Visé;LG;Cheratte,Wezet
4606;Dalhem;LG;Saint-André
4607;Dalhem;LG;Berneau,Bombaye,Feneur,Mortroux
4608;Dalhem;LG;Neufchâteau,Warsage
4610;Beyne-Heusay;LG;Bellaire,Queue-du-Bois
4620;Fléron;LG;
4621;Fléron;LG;Retinne
4623;Fléron;LG;Magnée
4624;Fléron;LG;Romsée
4630;Soumagne;LG;Ayeneux,Micheroux,Tignée,Évegnée-Tignée
4631;Soumagne;LG;Evegnée,Évegnée-Tignée
4632;Soumagne;LG;Cerexhe-Heuseux
4633;Soumagne;LG;Melen
4650;Herve;LG;Chaineux,Grand-Rechain,Julémont
4651;Herve;LG;Battice
4652;Herve;LG;Xhendelesse
4653;Herve;LG;Bolland
4654;Herve;LG;Charneux
4670;Blegny;LG;Mortier,Trembleur
4671;Blegny;LG;Barchon,Housse,Saive
4672;Blegny;LG;Saint-Remy
4680;Oupeye;LG;Hermée
4681;Oupeye;LG;Hermalle-sous-Argenteau
4682;Oupeye;LG;Heure-le-Romain,Houtain-Saint-Siméon
4683;Oupeye;LG;Vivegnis
4684;Oupeye;LG;Haccourt
4690;Bassenge;LG;Bitsingen,Boirs,Eben-Emael,Glons,Roclenge-sur-Geer,Wonck
4700;Eupen;LG;
4701;Eupen;LG;Kettenis
4710;Lontzen;LG;
4711;Lontzen;LG;Walhorn
4720;Kelmis;LG;La Calamine
4721;Kelmis;LG;La Calamine,Neu-Moresnet
4728;Kelmis;LG;Hergenrath,La Calamine
4730;Raeren;LG;Hauset
4731;Raeren;LG;Eynatten
4750;Bütgenbach;LG;Elsenborn
4760;Büllingen;LG;Bullange,Manderfeld
4761;Büllingen;LG;Bullange,Rocherath
4770;Amel;LG;Amblève,Meyerode
4771;Amel;LG;Amblève,Heppenbach
4780;Sankt Vith;LG;Recht,Saint-Vith
4782;Sankt Vith;LG;Saint-Vith,Schoenberg,Schönberg
4783;Sankt Vith;LG;Lommersweiler,Saint-Vith
4784;Sankt Vith;LG;Crombach,Saint-Vith
4790;Burg-Reuland;LG;Reuland
4791;Burg-Reuland;LG;Thommen
4800;Verviers;LG;Ensival,Heusy,Lambermont,Petit-Rechain,Polleur
4801;Verviers;LG;Stembert
4802;Verviers;LG;Heusy
4820;Dison;LG;
4821;Dison;LG;Andrimont
4830;Limbourg;LG;Limburg
4831;Limbourg;LG;Bilstain,Limburg
4834;Limbourg;LG;Goé,Limburg
4837;Baelen;LG;Membach
4840;Welkenraedt;LG;
4841;Welkenraedt;LG;Henri-Chapelle
4845;Jalhay;LG;Sart,Sart-lez-Spa
4850;Plombières;LG;Montzen,Moresnet
4851;Plombières;LG;Gemmenich,Sippenaeken
4852;Plombières;LG;Hombourg
4860;Pepinster;LG;Cornesse,Wegnez
4861;Pepinster;LG;Soiron
4870;Olne;LG;Forêt,Fraipont,Nessonvaux,Trooz
4877;Olne;LG;
4880;Aubel;LG;
4890;Thimister-Clermont;LG;Clermont,Thimister
4900;Spa;LG;
4910;Theux;LG;La Reid,Polleur
4920;Aywaille;LG;Ernonheid,Harzé,Louveigné
4950;Waimes;LG;Faymonville,Robertville,Sourbrodt,Weismes
4960;Malmedy;LG;Bevercé
4970;Stavelot;LG;Francorchamps
4980;Trois-Ponts;LG;Fosse,Wanne
4983;Trois-Ponts;LG;Basse-Bodeux
4987;Stoumont;LG;Chevron,La Gleize,Lorcé,Rahier
4990;Lierneux;LG;Arbrefontaine,Bra
5000;Namur;NA;Beez,Namen
5001;Namur;NA;Belgrade,Namen
5002;Namur;NA;Namen,Saint-Servais
5003;Namur;NA;Namen,Saint-Marc
5004;Namur;NA;Bouge,Namen
5010;Namur;NA;Namen
5012;Namur;NA;Namen
5020;Namur;NA;Champion,Daussoulx,Flawinne,Malonne,Namen,Suarlée,Temploux,Vedrin
5021;Namur;NA;Boninne,Namen
5022;Namur;NA;Cognelée,Namen
5024;Namur;NA;Gelbressée,Marche-les-Dames,Namen
5030;Gembloux;NA;Beuzet,Ernage,Grand-Manil,Lonzée,Sauvenière
5031;Gembloux;NA;Grand-Leez
5032;Gembloux;NA;Bossière,Bothey,Corroy-le-Château,Isnes,Mazy
5060;Sambreville;NA;Arsimont,Auvelais,Falisolle,Keumiée,Moignelée,Tamines,Velaine-sur-Sambre
5070;Fosses-la-Ville;NA;Aisemont,Le Roux,Sart-Eustache,Sart-Saint-Laurent,Vitrival
5080;La Bruyère;NA;Emines,Rhisnes,Villers-lez-Heest,Warisoulx
5081;La Bruyère;NA;Bovesse,Meux,Saint-Denis
5100;Namur;NA;Dave,Jambes,Namen,Naninne,Wierde,Wépion
5101;Namur;NA;Erpent,Lives-sur-Meuse,Loyers,Namen
5140;Sombreffe;NA;Boignée,Ligny,Tongrinne
5150;Floreffe;NA;Floriffoux,Franière,Soye
5170;Profondeville;NA;Arbre,Bois-de-Villers,Lesve,Lustin,Rivière
5190;Jemeppe-sur-Sambre;NA;Balâtre,Ham-sur-Sambre,Mornimont,Moustier,Moustier-sur-Sambre,Onoz,Saint-Martin,Spy
5300;Andenne;NA;Bonneville,Coutisse,Landenne,Maizeret,Namêche,Sclayn,Seilles,Thon,Vezin
5310;Éghezée;NA;Aische-en-Refail,Bolinne,Boneffe,Branchon,Dhuy,Hanret,Leuze,Liernu,Longchamps,Mehaigne,Noville-sur-Méhaigne,Saint-Germain,Taviers,Upigny,Waret-la-Chaussée
5330;Assesse;NA;Maillen,Sart-Bernard
5332;Assesse;NA;Crupet
5333;Assesse;NA;Sorinne-la-Longue
5334;Assesse;NA;Florée
5336;Assesse;NA;Courrière
5340;Gesves;NA;Faulx-les-Tombes,Haltinne,Mozet,Sorée
5350;Ohey;NA;Evelette,Haillot
5351;Ohey;NA;Haillot
5352;Ohey;NA;Perwez
5353;Ohey;NA;Goesnes
5354;Ohey;NA;Jallet
5360;Hamois;NA;Natoye
5361;Hamois;NA;Mohiville,Scy
5362;Hamois;NA;Achet
5363;Hamois;NA;Emptinne
5364;Hamois;NA;Schaltin
5370;Havelange;NA;Barvaux-Condroz,Flostoy,Jeneffe,Porcheresse,Verlée
5372;Havelange;NA;Méan
5374;Havelange;NA;Maffe
5376;Havelange;NA;Miécret
5377;Somme-Leuze;NA;Baillonville,Bonsin,Heure,Hogne,Nettinne,Noiseux,Sinsin,Waillet
5380;Fernelmont;NA;Bierwart,Cortil-Wodon,Forville,Franc-Waret,Hemptinne,Hingeon,Marchovelette,Noville-les-Bois,Pontillas,Tillier
5500;Dinant;NA;Anseremme,Bouvignes-sur-Meuse,Dréhance,Falmagne,Falmignoul,Furfooz
5501;Dinant;NA;Lisogne
5502;Dinant;NA;Thynes
5503;Dinant;NA;Sorinnes
5504;Dinant;NA;Foy-Notre-Dame
5520;Onhaye;NA;Anthée
5521;Onhaye;NA;Serville
5522;Onhaye;NA;Falaen
5523;Onhaye;NA;Sommière,Weillen
5524;Onhaye;NA;Gerin
5530;Yvoir;NA;Dorinne,Durnal,Evrehailles,Godinne,Houx,Mont,Purnode,Spontin
5537;Anhée;NA;Annevoie-Rouillon,Bioul,Denée,Haut-le-Wastia,Sosoye,Warnant
5540;Hastière;NA;Hastière-Lavaux,Hastière-par-delà,Hermeton-sur-Meuse,Waulsort
5541;Hastière;NA;Hastière-Par-Delà
5542;Hastière;NA;Blaimont
5543;Hastière;NA;Heer
5544;Hastière;NA;Agimont
5550;Vresse-sur-Semois;NA;Alle,Bagimont,Bohan,Chairière,Laforet,Membre,Mouzaive,Nafraiture,Orchimont,Pussemange,Sugny
5555;Bièvre;NA;Baillamont,Bellefontaine,Cornimont,Graide,Gros-Fays,Monceau-en-Ardenne,Naomé,Oizy,Petit-Fays
5560;Houyet;NA;Ciergnon,Finnevaux,Hulsonniaux,Mesnil-Eglise,Mesnil-Saint-Blaise
5561;Houyet;NA;Celles
5562;Houyet;NA;Custinne
5563;Houyet;NA;Hour
5564;Houyet;NA;Wanlin
5570;Beauraing;NA;Baronville,Dion,Felenne,Feschaux,Honnay,Javingue,Vonêche,Wancennes,Winenne
5571;Beauraing;NA;Wiesme
5572;Beauraing;NA;Focant
5573;Beauraing;NA;Martouzin-Neuville
5574;Beauraing;NA;Pondrôme
5575;Gedinne;NA;Bourseigne-Neuve,Bourseigne-Vieille,Houdremont,Louette-Saint-Denis,Louette-Saint-Pierre,Malvoisin,Patignies,Rienne,Sart-Custinne,Vencimont,Willerzie
5576;Beauraing;NA;Froidfontaine
5580;Rochefort;NA;Ave-et-Auffe,Buissonville,Eprave,Han-sur-Lesse,Jemelle,Lessive,Mont-Gauthier,Villers-sur-Lesse,Wavreille
5589;Rochefort;NA;Jemelle
5590;Ciney;NA;Achêne,Braibant,Chevetogne,Conneux,Haversin,Leignon,Pessoux,Serinchamps,Sovet
5600;Philippeville;NA;Fagnolle,Franchimont,Jamagne,Jamiolle,Merlemont,Neuville,Omezée,Roly,Romedenne,Samart,Sart-en-Fagne,Sautour,Surice,Villers-en-Fagne,Villers-le-Gambon,Vodecée
5620;Florennes;NA;Corenne,Flavion,Hemptinne-lez-Florennes,Morville,Rosée,Saint-Aubin
5621;Florennes;NA;Hanzinelle,Hanzinne,Morialmé
5630;Cerfontaine;NA;Daussois,Senzeille,Silenrieux,Soumoy,Villers-Deux-Eglises
5640;Mettet;NA;Biesme,Biesmerée,Graux,Oret,Saint-Gérard
5641;Mettet;NA;Furnaux
5644;Mettet;NA;Ermeton-sur-Biert
5646;Mettet;NA;Stave
5650;Walcourt;NA;Castillon,Chastrès,Clermont,Fontenelle,Fraire,Pry,Vogenée,Yves-Gomezée
5651;Walcourt;NA;Berzée,Gourdinne,Laneffe,Rognée,Somzée,Tarcienne,Thy-le-Château
5660;Couvin;NA;Aublain,Boussu-en-Fagne,Brûly,Brûly-de-Pesche,Cul-des-Sarts,Dailly,Frasnes,Gonrieux,Mariembourg,Pesche,Petigny,Petite-Chapelle,Presgaux
5670;Viroinval;NA;Dourbes,Le Mesnil,Mazée,Nismes,Oignies-en-Thiérache,Olloy-sur-Viroin,Treignes,Vierves-sur-Viroin
5680;Doische;NA;Gimnée,Gochenée,Matagne-la-Grande,Matagne-la-Petite,Niverlée,Romerée,Soulme,Vaucelles,Vodelée
6000;Charleroi;HT;
6001;Charleroi;HT;Marcinelle
6010;Charleroi;HT;Couillet
6020;Charleroi;HT;Dampremy
6030;Charleroi;HT;Goutroux,Marchienne-Au-Pont
6031;Charleroi;HT;Monceau-sur-Sambre
6032;Charleroi;HT;Mont-sur-Marchienne
6040;Charleroi;HT;Jumet
6041;Charleroi;HT;Gosselies
6042;Charleroi;HT;Lodelinsart
6043;Charleroi;HT;Ransart
6044;Charleroi;HT;Roux
6060;Charleroi;HT;Gilly
6061;Charleroi;HT;Montignies-sur-Sambre
6075;Fleurus;HT;
6099;Fleurus;HT;
6110;Montigny-le-Tilleul;HT;Montignies-le-Tilleul
6111;Montigny-le-Tilleul;HT;Landelies
6120;Ham-sur-Heure-Nalinnes;HT;Cour-sur-Heure,Ham-sur-Heure,Jamioulx,Marbaix,Nalinnes
6140;Fontaine-l'Évêque;HT;
6141;Fontaine-l'Évêque;HT;Forchies-la-Marche
6142;Fontaine-l'Évêque;HT;Leernes
6150;Anderlues;HT;
6180;Courcelles;HT;
6181;Courcelles;HT;Gouy-lez-Piéton
6182;Courcelles;HT;Souvret
6183;Courcelles;HT;Trazegnies
6200;Châtelet;HT;Bouffioulx,Châtelineau
6210;Les Bons Villers;HT;Frasnes-lez-Gosselies,Rèves,Villers-Perwin,Wayaux
6211;Les Bons Villers;HT;Mellet
6220;Fleurus;HT;Heppignies,Lambusart,Wangenies
6221;Fleurus;HT;Saint-Amand
6222;Fleurus;HT;Brye
6223;Fleurus;HT;Wagnelée
6224;Fleurus;HT;Wanfercée-Baulet
6230;Pont-à-Celles;HT;Buzet,Luttre,Obaix,Thiméon,Viesville
6238;Pont-à-Celles;HT;Liberchies,Luttre
6240;Farciennes;HT;Pironchamps
6250;Aiseau-Presles;HT;Aiseau,Pont-de-Loup,Presles,Roselies
6280;Gerpinnes;HT;Acoz,Gougnies,Joncret,Loverval,Villers-Poterie
6440;Froidchapelle;HT;Boussu-lez-Walcourt,Fourbechies,Vergnies
6441;Froidchapelle;HT;Erpion
6460;Chimay;HT;Bailièvre,Robechies,Saint-Remy,Salles,Villers-la-Tour
6461;Chimay;HT;Virelles
6462;Chimay;HT;Vaulx,Vaulx-lez-Chimay
6463;Chimay;HT;Lompret
6464;Chimay;HT;Baileux,Bourlers,Forges,L'escaillère,Rièzes
6470;Sivry-Rance;HT;Grandrieu,Montbliart,Rance,Sautin,Sivry
6500;Beaumont;HT;Barbençon,Leugnies,Leval-Chaudeville,Renlies,Solre-Saint-Géry,Thirimont
6511;Beaumont;HT;Strée
6530;Thuin;HT;Leers-et-Fosteau
6531;Thuin;HT;Biesme-sous-Thuin
6532;Thuin;HT;Ragnies
6533;Thuin;HT;Biercée
6534;Thuin;HT;Gozée
6536;Thuin;HT;Donstiennes,Thuillies
6540;Lobbes;HT;Mont-Sainte-Geneviève
6542;Lobbes;HT;Sars-la-Buissière
6543;Lobbes;HT;Bienne-lez-Happart
6560;Erquelinnes;HT;Bersillies-L'abbaye,Grand-Reng,Hantes-Wihéries,Montignies-Saint-Christophe,Solre-sur-Sambre
6567;Merbes-le-Château;HT;Fontaine-Valmont,Labuissière,Merbes-Sainte-Marie
6590;Momignies;HT;
6591;Momignies;HT;Macon
6592;Momignies;HT;Monceau-Imbrechies
6593;Momignies;HT;Macquenoise
6594;Momignies;HT;Beauwelz
6596;Momignies;HT;Forge-Philippe,Seloignes
6600;Bastogne;LX;Bastenaken,Bastnach,Longvilly,Noville,Villers-la-Bonne-Eau,Wardin
6630;Martelange;LX;
6637;Fauvillers;LX;Hollange,Tintange
6640;Vaux-sur-Sûre;LX;Hompré,Morhet,Nives,Sibret,Vaux-lez-Rosières
6642;Juseret;LX;
6660;Houffalize;LX;Nadrin
6661;Houffalize;LX;Mont,Tailles
6662;Houffalize;LX;Tavigny
6663;Houffalize;LX;Mabompré
6666;Houffalize;LX;Wibrin
6670;Gouvy;LX;Limerlé
6671;Gouvy;LX;Bovigny
6672;Gouvy;LX;Beho
6673;Gouvy;LX;Cherain
6674;Gouvy;LX;Montleban
6680;Sainte-Ode;LX;Amberloup,Tillet
6681;Sainte-Ode;LX;Lavacherie
6686;Bastogne;LX;Bastenaken,Bastnach,Flamierge
6687;Bastogne;LX;Bastenaken,Bastnach,Bertogne
6688;Bastogne;LX;Bastenaken,Bastnach,Longchamps
6690;Vielsalm;LX;Bihain,Petit-Thier
6692;Vielsalm;LX;Petit-Thier
6698;Vielsalm;LX;Grand-Halleux
6700;Arlon;LX;Aarlen,Bonnert,Heinsch,Toernich
6704;Arlon;LX;Aarlen,Guirsch
6706;Arlon;LX;Aarlen,Autelbas
6717;Attert;LX;Nobressart,Nothomb,Thiaumont,Tontelange
6720;Habay;LX;Habay-la-Neuve,Hachy
6721;Habay;LX;Anlier
6723;Habay;LX;Habay-la-Vieille
6724;Habay;LX;Houdemont,Rulles
6730;Tintigny;LX;Bellefontaine,Rossignol,Saint-Vincent
6740;Étalle;LX;Sainte-Marie-sur-Semois,Villers-sur-Semois
6741;Étalle;LX;Vance
6742;Étalle;LX;Chantemelle
6743;Étalle;LX;Buzenol
6747;Saint-Léger;LX;Châtillon,Meix-le-Tige
6750;Musson;LX;Mussy-la-Ville,Signeulx
6760;Virton;LX;Bleid,Ethe,Ruette
6761;Virton;LX;Latour
6762;Virton;LX;Saint-Mard
6767;Rouvroy;LX;Dampicourt,Harnoncourt,Lamorteau,Torgny
6769;Meix-devant-Virton;LX;Gérouville,Robelmont,Sommethonne,Villers-la-Loue
6780;Messancy;LX;Hondelange,Wolkrange
6781;Messancy;LX;Sélange
6782;Messancy;LX;Habergy
6790;Aubange;LX;
6791;Aubange;LX;Athus
6792;Aubange;LX;Halanzy,Rachecourt
6800;Libramont-Chevigny;LX;Bras,Freux,Moircy,Recogne,Remagne,Saint-Pierre,Sainte-Marie-Chevigny
6810;Chiny;LX;Izel,Jamoigne
6811;Chiny;LX;Les Bulles,Suxy
6812;Chiny;LX;Suxy
6813;Chiny;LX;Termes
6820;Florenville;LX;Fontenoille,Muno,Sainte-Cécile
6821;Florenville;LX;Lacuisine
6823;Florenville;LX;Villers-Devant-Orval
6824;Florenville;LX;Chassepierre
6830;Bouillon;LX;Les Hayons,Poupehan,Rochehaut
6831;Bouillon;LX;Noirefontaine,Noirfontaine
6832;Bouillon;LX;Sensenruth
6833;Bouillon;LX;Ucimont,Vivy
6834;Bouillon;LX;Bellevaux
6836;Bouillon;LX;Dohan
6838;Bouillon;LX;Corbion
6840;Neufchâteau;LX;Grandvoir,Grapfontaine,Hamipré,Longlier,Tournay
6850;Paliseul;LX;Carlsbourg,Offagne
6851;Paliseul;LX;Nollevaux
6852;Paliseul;LX;Maissin,Opont
6853;Paliseul;LX;Framont
6856;Paliseul;LX;Fays-les-Veneurs
6860;Léglise;LX;Assenois,Ebly,Mellier,Witry
6870;Saint-Hubert;LX;Arville,Awenne,Hatrival,Mirwart,Vesqueville
6880;Bertrix;LX;Auby-sur-Semois,Cugnon,Jehonville,Orgeo
6887;Herbeumont;LX;Saint-Médard,Straimont
6890;Libin;LX;Anloy,Ochamps,Redu,Smuid,Transinne,Villance
6900;Marche-en-Famenne;LX;Aye,Hargimont,Humain,On,Roy,Waha
6920;Wellin;LX;Sohier
6921;Wellin;LX;Chanly
6922;Wellin;LX;Halma
6924;Wellin;LX;Lomprez
6927;Tellin;LX;Bure,Grupont,Resteigne
6929;Daverdisse;LX;Gembes,Haut-Fays,Porcheresse
6940;Durbuy;LX;Grandhan,Septon,Wéris
6941;Durbuy;LX;Bende,Bomal,Bomal-sur-Ourthe,Borlon,Heyd,Izier,Tohogne,Villers-Sainte-Gertrude
6950;Nassogne;LX;Harsin
6951;Nassogne;LX;Bande
6952;Nassogne;LX;Grune
6953;Nassogne;LX;Ambly,Forrières,Lesterny,Masbourg
6960;Manhay;LX;Dochamps,Grandmenil,Harre,Malempré,Odeigne,Vaux-Chavanne
6970;Tenneville;LX;
6971;Tenneville;LX;Champlon
6972;Tenneville;LX;Erneuville
6980;La Roche-en-Ardenne;LX;Beausaint
6982;La Roche-en-Ardenne;LX;Samrée
6983;La Roche-en-Ardenne;LX;Ortho
6984;La Roche-en-Ardenne;LX;Hives
6986;La Roche-en-Ardenne;LX;Halleux
6987;Rendeux;LX;Beffe,Hodister,Marcourt
6990;Hotton;LX;Fronville,Hampteau,Marenne
6997;Érezée;LX;Amonines,Mormont,Soy
7000;Mons;HT;Bergen
7010;Mons;HT;Bergen,Maisières
7011;Mons;HT;Bergen,Ghlin
7012;Mons;HT;Bergen,Flénu,Jemappes
7020;Mons;HT;Bergen,Maisières,Nimy
7021;Mons;HT;Bergen,Havre
7022;Mons;HT;Bergen,Harmignies,Harveng,Hyon,Mesvin,Nouvelles
7024;Mons;HT;Bergen,Ciply
7030;Mons;HT;Bergen,Saint-Symphorien
7031;Mons;HT;Bergen,Villers-Saint-Ghislain
7032;Mons;HT;Bergen,Spiennes
7033;Mons;HT;Bergen,Cuesmes
7034;Mons;HT;Bergen,Obourg,Saint-Denis
7040;Quévy;HT;Asquillies,Aulnois,Blaregnies,Bougnies,Genly,Goegnies-Chaussée,Quévy-le-Grand,Quévy-le-Petit
7041;Quévy;HT;Givry,Havay
7050;Jurbise;HT;Erbaut,Erbisoeul,Herchies,Jurbeke,Masnuy-Saint-Jean,Masnuy-Saint-Pierre
7060;Soignies;HT;Horrues,Zinnik
7061;Soignies;HT;Casteau,Thieusies,Zinnik
7062;Soignies;HT;Naast,Zinnik
7063;Soignies;HT;Chaussée-Notre-Dame-Louvignies,Neufvilles,Zinnik
7070;Le Roeulx;HT;Gottignies,Mignault,Thieu,Ville-sur-Haine
7080;Frameries;HT;Eugies,La Bouverie,Noirchain,Sars-la-Bruyère
7090;Braine-le-Comte;HT;'s Gravenbrakel,Hennuyères,Henripont,Petit-Roeulx-lez-Braine,Ronquières,Steenkerque
7100;La Louvière;HT;Haine-Saint-Paul,Haine-Saint-Pierre,Saint-Vaast,Trivières
7110;La Louvière;HT;Boussoit,Houdeng-Aimeries,Houdeng-Goegnies,Maurage,Strépy-Bracquegnies
7120;Estinnes;HT;Croix-lez-Rouveroy,Estinnes-Au-Mont,Estinnes-Au-Val,Fauroeulx,Haulchin,Peissant,Rouveroy,Vellereille-le-Sec,Vellereille-les-Brayeux
7130;Binche;HT;Battignies,Bray
7131;Binche;HT;Waudrez
7133;Binche;HT;Buvrinnes
7134;Binche;HT;Epinois,Leval-Trahegnies,Péronnes-lez-Binche,Ressaix
7140;Morlanwelz;HT;Morlanwelz-Mariemont
7141;Morlanwelz;HT;Carnières,Mont-Sainte-Aldegonde
7160;Chapelle-lez-Herlaimont;HT;Godarville,Piéton
7170;Manage;HT;Bellecourt,Bois-D'haine,Fayt-lez-Manage,La Hestre
7180;Seneffe;HT;
7181;Seneffe;HT;Arquennes,Familleureux,Feluy,Petit-Roeulx-lez-Nivelles
7190;Écaussinnes;HT;Ecaussinnes-D'enghien,Marche-lez-Ecaussinnes
7191;Écaussinnes;HT;Ecaussinnes-Lalaing,Écaussinnes-d'Enghien
7300;Boussu;HT;
7301;Boussu;HT;Hornu
7320;Bernissart;HT;
7321;Bernissart;HT;Blaton,Harchies
7322;Bernissart;HT;Pommeroeul,Ville-Pommeroeul
7330;Saint-Ghislain;HT;
7331;Saint-Ghislain;HT;Baudour
7332;Saint-Ghislain;HT;Neufmaison,Sirault
7333;Saint-Ghislain;HT;Tertre
7334;Saint-Ghislain;HT;Hautrage,Villerot
7340;Colfontaine;HT;Paturages,Warquignies,Wasmes
7350;Hensies;HT;Hainin,Montroeul-sur-Haine,Montrœul-sur-Haine,Thulin
7370;Dour;HT;Blaugies,Elouges,Wihéries
7380;Quiévrain;HT;Baisieux
7382;Quiévrain;HT;Audregnies
7387;Honnelles;HT;Angre,Angreau,Athis,Autreppe,Erquennes,Fayt-le-Franc,Marchipont,Montignies-sur-Roc,Onnezies,Roisin
7390;Quaregnon;HT;Wasmuel
7500;Tournai;HT;Doornik,Ere,Saint-Maur
7501;Tournai;HT;Doornik,Orcq
7502;Tournai;HT;Doornik,Esplechin
7503;Tournai;HT;Doornik,Froyennes
7504;Tournai;HT;Doornik,Froidmont
7506;Tournai;HT;Doornik,Willemeau
7510;Tournai;HT;Doornik,Orcq
7511;Tournai;HT;Doornik,Orcq
7512;Tournai;HT;Doornik,Kain
7513;Tournai;HT;Doornik,Kain
7520;Tournai;HT;Doornik,Ramegnies-Chin,Templeuve
7521;Tournai;HT;Chercq,Doornik
7522;Tournai;HT;Blandain,Doornik,Hertain,Lamain,Marquain
7530;Tournai;HT;Doornik,Gaurain-Ramecroix
7531;Tournai;HT;Doornik,Havinnes
7532;Tournai;HT;Beclers,Doornik
7533;Tournai;HT;Doornik,Thimougies
7534;Tournai;HT;Barry,Doornik,Maulde
7536;Tournai;HT;Doornik,Vaulx
7538;Tournai;HT;Doornik,Vezon
7540;Tournai;HT;Doornik,Kain,Melles,Mourcourt,Quartes,Rumillies
7542;Tournai;HT;Doornik,Mont-Saint-Aubert
7543;Tournai;HT;Doornik,Mourcourt
7548;Tournai;HT;Doornik,Warchin
7600;Péruwelz;HT;
7601;Péruwelz;HT;Roucourt
7602;Péruwelz;HT;Bury
7603;Péruwelz;HT;Bon-Secours
7604;Péruwelz;HT;Baugnies,Braffe,Brasmenil,Callenelle,Wasmes-Audemez-Briffoeil
7608;Péruwelz;HT;Wiers
7610;Rumes;HT;
7611;Rumes;HT;La Glanerie
7618;Rumes;HT;Taintignies
7620;Brunehaut;HT;Bléharies,Guignies,Hollain,Jollain-Merlin,Wez-Velvain
7621;Brunehaut;HT;Lesdain
7622;Brunehaut;HT;Laplaigne
7623;Brunehaut;HT;Rongy
7624;Brunehaut;HT;Howardries
7640;Antoing;HT;Maubray,Péronnes-lez-Antoing
7641;Antoing;HT;Bruyelle
7642;Antoing;HT;Calonne
7643;Antoing;HT;Fontenoy
7700;Mouscron;HT;Luingne,Moeskroen
7711;Mouscron;HT;Dottignies,Moeskroen
7712;Mouscron;HT;Herseaux,Moeskroen
7730;Estaimpuis;HT;Bailleul,Estaimbourg,Evregnies,Leers-Nord,Néchin,Saint-Léger
7740;Pecq;HT;Warcoing
7742;Pecq;HT;Hérinnes,Hérinnes-lez-Pecq
7743;Pecq;HT;Esquelmes,Obigies
7750;Mont-de-l'Enclus;HT;Amougies,Anseroeul,Orroir,Russeignies
7760;Celles;HT;Escanaffles,Molenbaix,Popuelles,Pottes,Velaines
7780;Comines-Warneton;HT;Comines,Komen-Waasten
7781;Comines-Warneton;HT;Houthem,Komen-Waasten
7782;Comines-Warneton;HT;Komen-Waasten,Ploegsteert
7783;Comines-Warneton;HT;Bizet,Komen-Waasten,Ploegsteert
7784;Comines-Warneton;HT;Bas-Warneton,Komen-Waasten,Warneton
7800;Ath;HT;Aat,Lanquesaint
7801;Ath;HT;Aat,Irchonwelz
7802;Ath;HT;Aat,Ormeignies
7803;Ath;HT;Aat,Bouvignies
7804;Ath;HT;Aat,Ostiches,Rebaix
7810;Ath;HT;Aat,Maffle
7811;Ath;HT;Aat,Arbre
7812;Ath;HT;Aat,Houtaing,Ligne,Mainvault,Moulbaix,Villers-Notre-Dame,Villers-Saint-Amand
7822;Ath;HT;Aat,Ghislenghien,Isières,Meslin-L'evêque
7823;Ath;HT;Aat,Gibecq
7830;Silly;HT;Bassilly,Fouleng,Gondregnies,Graty,Hellebecq,Hoves,Opzullik,Thoricourt
7850;Silly;HT;Enghien,Hoves,Marcq,Opzullik,Petit-Enghien
7860;Lessines;HT;Lessen
7861;Lessines;HT;Lessen,Papignies,Wannebecq
7862;Lessines;HT;Lessen,Ogy
7863;Lessines;HT;Ghoy,Lessen
7864;Lessines;HT;Deux-Acren,Lessen
7866;Lessines;HT;Bois-de-Lessines,Lessen,Ollignies
7870;Lens;HT;Bauffe,Cambron-Saint-Vincent,Lombise,Montignies-lez-Lens
7880;Flobecq;HT;Vloesberg
7890;Ellezelles;HT;Elzele,Lahamaide,Wodecq
7900;Leuze-en-Hainaut;HT;Grandmetz,Leuze
7901;Leuze-en-Hainaut;HT;Thieulain
7903;Leuze-en-Hainaut;HT;Blicquy,Chapelle-À-Oie,Chapelle-À-Wattines
7904;Leuze-en-Hainaut;HT;Leuze,Pipaix,Tourpes,Willaupuis
7906;Leuze-en-Hainaut;HT;Gallaix
7910;Frasnes-lez-Anvaing;HT;Anvaing,Arc-Wattripont,Cordes,Ellignies-lez-Frasnes,Forest,Wattripont
7911;Frasnes-lez-Anvaing;HT;Buissenal,Frasnes-lez-Buissenal,Hacquegnies,Herquegies,Montroeul-Au-Bois,Moustier,Oeudeghien
7912;Frasnes-lez-Anvaing;HT;Dergneau,Saint-Sauveur
7940;Brugelette;HT;Cambron-Casteau
7941;Brugelette;HT;Attre
7942;Brugelette;HT;Mévergnies-lez-Lens
7943;Brugelette;HT;Gages
7950;Chièvres;HT;Grosage,Huissignies,Ladeuze,Tongre-Saint-Martin
7951;Chièvres;HT;Tongre-Notre-Dame
7970;Beloeil;HT;Belœil
7971;Beloeil;HT;Basècles,Ramegnies,Thumaide,Wadelincourt
7972;Beloeil;HT;Aubechies,Ellignies-Sainte-Anne,Quevaucamps
7973;Beloeil;HT;Grandglise,Stambruges
8000;Brugge;FO;Bruges,Koolkerke
8020;Oostkamp;FO;Hertsberge,Ruddervoorde,Waardamme
8200;Brugge;FO;Bruges,Sint-Andries,Sint-Michiels
8210;Zedelgem;FO;Loppem,Veldegem
8211;Zedelgem;FO;Aartrijke
8300;Knokke-Heist;FO;Knokke,Westkapelle
8301;Knokke-Heist;FO;Ramskapelle
8310;Brugge;FO;Assebroek,Bruges,Sint-Kruis
8340;Damme;FO;Hoeke,Lapscheure,Moerkerke,Oostkerke,Sijsele
8370;Blankenberge;FO;Uitkerke
8377;Zuienkerke;FO;Houtave,Meetkerke,Nieuwmunster
8380;Brugge;FO;Bruges,Dudzele,Lissewege,Zeebrugge
8400;Oostende;FO;Ostende,Stene,Zandvoorde
8420;De Haan;FO;Klemskerke,Wenduine
8421;De Haan;FO;Vlissegem
8430;Middelkerke;FO;Wilskerke
8431;Middelkerke;FO;Wilskerke
8432;Middelkerke;FO;Leffinge
8433;Middelkerke;FO;Mannekensvere,Schore,Sint-Pieters-Kapelle,Slijpe
8434;Middelkerke;FO;Lombardsijde,Westende
8450;Bredene;FO;
8460;Oudenburg;FO;Ettelgem,Roksem,Westkerke
8470;Gistel;FO;Moere,Snaaskerke,Zevekote
8480;Ichtegem;FO;Bekegem,Eernegem
8490;Jabbeke;FO;Snellegem,Stalhille,Varsenare,Zerkegem
8500;Kortrijk;FO;Courtrai
8501;Kortrijk;FO;Bissegem,Courtrai,Heule
8510;Kortrijk;FO;Bellegem,Courtrai,Kooigem,Marke,Rollegem
8511;Kortrijk;FO;Aalbeke,Courtrai
8520;Kuurne;FO;
8530;Harelbeke;FO;
8531;Harelbeke;FO;Bavikhove,Hulste
8540;Deerlijk;FO;
8550;Zwevegem;FO;
8551;Zwevegem;FO;Heestert
8552;Zwevegem;FO;Moen
8553;Zwevegem;FO;Otegem
8554;Zwevegem;FO;Sint-Denijs
8560;Wevelgem;FO;Gullegem,Moorsele
8570;Anzegem;FO;Gijzelbrechtegem,Ingooigem,Vichte
8572;Anzegem;FO;Kaster
8573;Anzegem;FO;Tiegem
8580;Avelgem;FO;
8581;Avelgem;FO;Kerkhove,Waarmaarde
8582;Avelgem;FO;Outrijve
8583;Avelgem;FO;Bossuit
8587;Spiere-Helkijn;FO;Espierres,Espierres-Helchin,Helchin,Helkijn
8600;Diksmuide;FO;Beerst,Dixmude,Driekapellen,Esen,Kaaskerke,Keiem,Lampernisse,Leke,Nieuwkapelle,Oostkerke,Oudekapelle,Pervijze,Stuivekenskerke,Vladslo,Woumen
8610;Kortemark;FO;Handzame,Werken,Zarren
8620;Nieuwpoort;FO;Nieuport,Ramskapelle,Sint-Joris
8630;Veurne;FO;Avekapelle,Booitshoeke,Bulskamp,De Moeren,Eggewaartskapelle,Furnes,Houtem,Steenkerke,Vinkem,Wulveringem,Zoutenaaie
8640;Vleteren;FO;Oostvleteren,Westvleteren,Woesten
8647;Lo-Reninge;FO;Lo,Noordschote,Pollinkhove,Reninge
8650;Houthulst;FO;Klerken,Merkem
8660;De Panne;FO;Adinkerke,La Panne
8670;Koksijde;FO;Oostduinkerke,Wulpen
8680;Koekelare;FO;Bovekerke,Zande
8690;Alveringem;FO;Hoogstade,Oeren,Sint-Rijkers
8691;Alveringem;FO;Gijverinkhove,Izenberge,Leisele,Stavele
8700;Tielt;FO;Aarsele,Kanegem,Schuiferskapelle
8710;Wielsbeke;FO;Ooigem,Sint-Baafs-Vijve
8720;Dentergem;FO;Markegem,Oeselgem,Wakken
8730;Beernem;FO;Oedelem,Sint-Joris
8740;Pittem;FO;Egem
8750;Wingene;FO;Zwevezele
8755;Wingene;FO;Ruiselede
8760;Tielt;FO;Meulebeke
8770;Ingelmunster;FO;
8780;Oostrozebeke;FO;
8790;Waregem;FO;
8791;Waregem;FO;Beveren
8792;Waregem;FO;Desselgem
8793;Waregem;FO;Sint-Eloois-Vijve
8800;Roeselare;FO;Beveren,Oekene,Roulers,Rumbeke
8810;Lichtervelde;FO;
8820;Torhout;FO;
8830;Hooglede;FO;Gits
8840;Staden;FO;Oostnieuwkerke,Westrozebeke
8850;Ardooie;FO;
8851;Ardooie;FO;Koolskamp
8860;Lendelede;FO;
8870;Izegem;FO;Emelgem,Kachtem
8880;Ledegem;FO;Rollegem-Kapelle,Sint-Eloois-Winkel
8890;Moorslede;FO;Dadizele
8900;Ieper;FO;Brielen,Dikkebus,Sint-Jan,Ypern,Ypres
8902;Ieper;FO;Hollebeke,Voormezele,Ypern,Ypres,Zillebeke
8904;Ieper;FO;Boezinge,Ypern,Ypres,Zuidschote
8906;Ieper;FO;Elverdinge,Ypern,Ypres
8908;Ieper;FO;Vlamertinge,Ypern,Ypres
8920;Langemark-Poelkapelle;FO;Bikschote,Langemark,Poelkapelle
8930;Menen;FO;Lauwe,Menin,Rekkem
8940;Wervik;FO;Geluwe
8950;Heuvelland;FO;Nieuwkerke
8951;Heuvelland;FO;Dranouter
8952;Heuvelland;FO;Wulvergem
8953;Heuvelland;FO;Wijtschate
8954;Heuvelland;FO;Westouter
8956;Heuvelland;FO;Kemmel
8957;Mesen;FO;Messines
8958;Heuvelland;FO;Loker
8970;Poperinge;FO;Reningelst
8972;Poperinge;FO;Krombeke,Proven,Roesbrugge-Haringe
8978;Poperinge;FO;Watou
8980;Zonnebeke;FO;Beselare,Geluveld,Passendale,Zandvoorde
9000;Gent;FE;Gand
9030;Gent;FE;Gand,Mariakerke
9031;Gent;FE;Drongen,Gand
9032;Gent;FE;Gand,Wondelgem
9040;Gent;FE;Gand,Sint-Amandsberg
9041;Gent;FE;Gand,Oostakker
9042;Gent;FE;Desteldonk,Gand,Mendonk,Sint-Kruis-Winkel
9050;Gent;FE;Gand,Gentbrugge,Ledeberg
9051;Gent;FE;Afsnee,Gand,Sint-Denijs-Westrem
9052;Gent;FE;Gand,Zwijnaarde
9060;Zelzate;FE;
9070;Destelbergen;FE;Heusden
9075;Gent;FE;Gand,Wondelgem
9080;Lochristi;FE;Beervelde,Zaffelare,Zeveneken
9090;Merelbeke-Melle;FE;Gontrode,Melle
9099;Gent;FE;Gand,Wondelgem
9100;Sint-Niklaas;FE;Nieuwkerken-Waas,Saint-Nicolas
9111;Sint-Niklaas;FE;Belsele,Saint-Nicolas
9112;Sint-Niklaas;FE;Saint-Nicolas,Sinaai,Sinaai-Waas
9120;Beveren-Kruibeke-Zwijndrecht;FE;Beveren,Haasdonk,Kallo,Melsele,Vrasene
9130;Beveren-Kruibeke-Zwijndrecht;FE;Doel,Kallo,Kieldrecht,Verrebroek
9140;Temse;FE;Elversele,Steendorp,Tamise,Tielrode
9150;Beveren-Kruibeke-Zwijndrecht;FE;Bazel,Kruibeke,Rupelmonde
9160;Lokeren;FE;Daknam,Eksaarde
9170;Sint-Gillis-Waas;FE;De Klinge,Meerdonk,Sint-Pauwels
9180;Lokeren;FE;Moerbeke,Moerbeke-Waas
9185;Lochristi;FE;Wachtebeke
9190;Stekene;FE;Kemzeke
9200;Dendermonde;FE;Appels,Baasrode,Grembergen,Mespelare,Oudegem,Schoonaarde,Sint-Gillis-Dendermonde,Termonde
9220;Hamme;FE;Moerzeke
9230;Wetteren;FE;Massemen,Westrem
9240;Zele;FE;
9250;Waasmunster;FE;
9255;Buggenhout;FE;Opdorp
9260;Wichelen;FE;Schellebelle,Serskamp
9270;Laarne;FE;Kalken
9280;Lebbeke;FE;Denderbelle,Wieze
9290;Berlare;FE;Overmere,Uitbergen
9300;Aalst;FE;Alost
9308;Aalst;FE;Alost,Gijzegem,Hofstade
9310;Aalst;FE;Alost,Baardegem,Herdersem,Meldert,Moorsel
9320;Aalst;FE;Alost,Erembodegem,Nieuwerkerken
9340;Lede;FE;Impe,Oordegem,Smetlede,Wanzele
9400;Ninove;FE;Appelterre-Eichem,Denderwindeke,Lieferinge,Nederhasselt,Okegem,Voorde
9401;Ninove;FE;Pollare
9402;Ninove;FE;Meerbeke
9403;Ninove;FE;Neigem
9404;Ninove;FE;Aspelare
9406;Ninove;FE;Outer
9420;Erpe-Mere;FE;Aaigem,Bambrugge,Burst,Erondegem,Erpe,Mere,Ottergem
9450;Haaltert;FE;Denderhoutem,Heldergem
9451;Haaltert;FE;Kerksken
9470;Denderleeuw;FE;
9472;Denderleeuw;FE;Iddergem
9473;Denderleeuw;FE;Welle
9500;Geraardsbergen;FE;Goeferdinge,Grammont,Moerbeke,Nederboelare,Onkerzele,Ophasselt,Overboelare,Viane,Zarlardinge
9506;Geraardsbergen;FE;Grammont,Grimminge,Idegem,Nieuwenhove,Schendelbeke,Smeerebbe-Vloerzegem,Waarbeke,Zandbergen
9520;Sint-Lievens-Houtem;FE;Bavegem,Oombergen,Vlierzele,Zonnegem
9521;Sint-Lievens-Houtem;FE;Letterhoutem
9550;Herzele;FE;Hillegem,Sint-Antelinks,Sint-Lievens-Esse,Steenhuize-Wijnhuize,Woubrechtegem
9551;Herzele;FE;Ressegem
9552;Herzele;FE;Borsbeke
9570;Lierde;FE;Deftinge,Sint-Maria-Lierde
9571;Lierde;FE;Hemelveerdegem
9572;Lierde;FE;Sint-Martens-Lierde
9600;Ronse;FE;Renaix
9620;Zottegem;FE;Elene,Erwetegem,Godveerdegem,Grotenberge,Leeuwergem,Oombergen,Sint-Goriks-Oudenhove,Sint-Maria-Oudenhove,Strijpen,Velzeke-Ruddershove
9630;Zwalm;FE;Beerlegem,Dikkele,Hundelgem,Meilegem,Munkzwalm,Paulatem,Roborst,Rozebeke,Sint-Blasius-Boekel,Sint-Denijs-Boekel,Sint-Maria-Latem
9636;Zwalm;FE;Nederzwalm-Hermelgem
9660;Brakel;FE;Elst,Everbeek,Michelbeke,Nederbrakel,Opbrakel,Sint-Maria-Oudenhove,Zegelsem
9661;Brakel;FE;Parike
9667;Horebeke;FE;Sint-Kornelis-Horebeke,Sint-Maria-Horebeke
9680;Maarkedal;FE;Etikhove,Maarke-Kerkem
9681;Maarkedal;FE;Nukerke
9688;Maarkedal;FE;Schorisse
9690;Kluisbergen;FE;Berchem,Kwaremont,Ruien,Zulzeke
9700;Oudenaarde;FE;Audenarde,Bevere,Edelare,Eine,Ename,Heurne,Leupegem,Mater,Melden,Mullem,Nederename,Ooike,Volkegem,Welden
9750;Kruisem;FE;Huise,Ouwegem,Zingem
9770;Kruisem;FE;Kruishoutem
9771;Kruisem;FE;Nokere
9772;Kruisem;FE;Wannegem-Lede
9790;Wortegem-Petegem;FE;Elsegem,Moregem,Ooike,Petegem-aan-de-Schelde,Wortegem
9800;Deinze;FE;Astene,Bachte-Maria-Leerne,Gottem,Grammene,Meigem,Petegem-aan-de-Leie,Sint-Martens-Leerne,Vinkt,Wontergem,Zeveren
9810;Nazareth-De Pinte;FE;Eke,Nazareth
9820;Merelbeke-Melle;FE;Bottelare,Lemberge,Melsen,Merelbeke,Munte,Schelderode
9830;Sint-Martens-Latem;FE;
9831;Sint-Martens-Latem;FE;Deurle
9840;Nazareth-De Pinte;FE;De Pinte,Zevergem
9850;Deinze;FE;Hansbeke,Landegem,Merendree,Nevele,Poesele,Vosselare
9860;Oosterzele;FE;Balegem,Gijzenzele,Landskouter,Moortsele,Scheldewindeke
9870;Zulte;FE;Machelen,Olsene
9880;Aalter;FE;Lotenhulle,Poeke
9881;Aalter;FE;Bellem
9890;Gavere;FE;Baaigem,Dikkelvenne,Vurste
9900;Eeklo;FE;
9910;Aalter;FE;Knesselare,Ursel
9920;Lievegem;FE;Lovendegem
9921;Lievegem;FE;Vinderhoute
9930;Lievegem;FE;Zomergem
9931;Lievegem;FE;Oostwinkel
9932;Lievegem;FE;Ronsele
9940;Evergem;FE;Ertvelde,Kluizen,Sleidinge
9950;Lievegem;FE;Waarschoot
9960;Assenede;FE;
9961;Assenede;FE;Boekhoute
9968;Assenede;FE;Bassevelde,Oosteeklo
9970;Kaprijke;FE;
9971;Kaprijke;FE;Lembeke
9980;Sint-Laureins;FE;
9981;Sint-Laureins;FE;Sint-Margriete
9982;Sint-Laureins;FE;Sint-Jan-In-Eremo
9988;Sint-Laureins;FE;Waterland-Oudeman,Watervliet
9990;Maldegem;FE;
9991;Maldegem;FE;Adegem
9992;Maldegem;FE;Middelburg`;

  var PROVINCES = {
    BW: 'Brabant wallon', BF: 'Brabant flamand', HT: 'Hainaut', LG: 'Liège', LX: 'Luxembourg',
    NA: 'Namur', AN: 'Anvers', LI: 'Limbourg', FO: 'Flandre occidentale', FE: 'Flandre orientale',
    BXL: 'Bruxelles-Capitale',
  };

  // Index construits À LA DEMANDE (première utilisation réelle), pas au chargement de la page :
  // aucune page ne paie le coût si Nicolas n'ouvre pas de formulaire d'adresse.
  var MAIN = null;    // { '1440': 'Braine-le-Château' }
  var PROV = null;    // { '1440': 'BW' }
  var ALIAS = null;   // { '1440': ['Kasteelbrakel', 'Wauthier-Braine'] }
  var BYNAME = null;  // { 'brainelechateau': ['1440'] }  (clé normalisée : sans accent ni tiret)
  var ALLROWS = null; // [{ cp, ville, prov }] pour la recherche par ville

  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // accents
      .replace(/[^a-z0-9]/g, '');                          // tirets, apostrophes, espaces
  }

  function build() {
    if (MAIN) return;
    MAIN = {}; PROV = {}; ALIAS = {}; BYNAME = {}; ALLROWS = [];
    var lines = RAW.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l) continue;
      var p = l.split(';');
      var cp = p[0], ville = p[1], prov = p[2] || '', alias = p[3] ? p[3].split(',') : [];
      if (!cp || !ville) continue;
      MAIN[cp] = ville; PROV[cp] = prov; ALIAS[cp] = alias;
      ALLROWS.push({ cp: cp, ville: ville, prov: prov });
      var names = [ville].concat(alias);
      for (var j = 0; j < names.length; j++) {
        var k = norm(names[j]);
        if (!k) continue;
        (BYNAME[k] = BYNAME[k] || []).indexOf(cp) < 0 && BYNAME[k].push(cp);
      }
    }
  }

  // ── API de données ─────────────────────────────────────────────────────────────────────────
  var SSPostal = {
    /** Localité principale d'un code postal ('1440' → 'Braine-le-Château'), '' si inconnu. */
    city: function (cp) { build(); return MAIN[String(cp || '').trim()] || ''; },
    /** Province en toutes lettres ('1440' → 'Brabant wallon'). */
    province: function (cp) { build(); return PROVINCES[PROV[String(cp || '').trim()]] || ''; },
    /** Toutes les localités d'un code postal, principale en tête. */
    localities: function (cp) {
      build(); cp = String(cp || '').trim();
      return MAIN[cp] ? [MAIN[cp]].concat(ALIAS[cp] || []) : [];
    },
    /** Codes postaux d'une localité — plusieurs si le nom est ambigu (Halle → 1500 et 2980). */
    codesForCity: function (name) { build(); return (BYNAME[norm(name)] || []).slice(); },
    /**
     * LE code postal d'une ville, ou '' si c'est ambigu.
     * Une commune est souvent éclatée en plusieurs codes (Mons = 7000 à 7034, Wavre = 1300/1301) :
     * le plus petit est toujours le code du centre, c'est celui qu'on veut. En revanche deux villes
     * DIFFÉRENTES qui portent le même nom (Halle 1500 en Brabant flamand, Halle 2980 à Zoersel)
     * restent ambiguës : on ne devine pas à la place de Nicolas.
     */
    codeOf: function (name) {
      build();
      var n = norm(name), codes = this.codesForCity(name);
      if (!codes.length) return '';
      var exact = codes.filter(function (cp) { return norm(MAIN[cp]) === n; });
      var pool = exact.length ? exact : codes;
      var noms = {};
      pool.forEach(function (cp) { noms[norm(MAIN[cp])] = 1; });
      if (Object.keys(noms).length > 1) return '';
      return pool.slice().sort()[0];
    },
    /** Vrai si ce nom de ville appartient bien à ce code postal (sous-localité comprise). */
    matches: function (cp, name) {
      build(); cp = String(cp || '').trim();
      return this.codesForCity(name).indexOf(cp) >= 0;
    },
    /** Découpe « 1440 Braine-le-Château » en { cp, ville }. Tolère l'ordre inverse. */
    split: function (txt) {
      var s = String(txt == null ? '' : txt).trim();
      var m = s.match(/^(\d{4})\s*(.*)$/) || s.match(/^(.*?)\s*(\d{4})$/);
      if (!m) return { cp: '', ville: s };
      var cp = /^\d{4}$/.test(m[1]) ? m[1] : m[2];
      var ville = (/^\d{4}$/.test(m[1]) ? m[2] : m[1]).trim();
      return { cp: cp, ville: ville };
    },

    /**
     * Suggestions pour une saisie libre : chiffres → recherche par code, lettres → par nom.
     * Priorité : correspondance exacte, puis début de mot, puis contenu — les localités
     * principales avant les alias, pour que « Bru » propose Bruxelles avant Brugelette.
     */
    suggest: function (query, max) {
      build();
      max = max || 8;
      var q = String(query == null ? '' : query).trim();
      if (!q) return [];
      var out = [], seen = {};
      var push = function (cp, via) {
        if (seen[cp] || out.length >= max) return;
        seen[cp] = 1;
        out.push({ cp: cp, ville: MAIN[cp], prov: PROVINCES[PROV[cp]] || '', via: (via && norm(via) !== norm(MAIN[cp])) ? via : '' });
      };
      var digits = q.replace(/\D/g, '');
      if (/^\d/.test(q) && digits) {
        // Saisie de code postal : « 14 » → 1400, 1401, 1410… (ordre croissant, comme sur une carte)
        for (var i = 0; i < ALLROWS.length && out.length < max; i++) {
          if (ALLROWS[i].cp.indexOf(digits) === 0) push(ALLROWS[i].cp);
        }
        // « 1440 Brai » : on affine avec la partie texte
        var reste = q.replace(/^\s*\d{1,4}\s*/, '');
        if (reste && out.length > 1) {
          var f = out.filter(function (o) { return norm(o.ville).indexOf(norm(reste)) >= 0; });
          if (f.length) return f;
        }
        return out;
      }
      // Saisie de nom de ville
      var nq = norm(q);
      if (!nq) return [];
      var exact = [], debut = [], dedans = [], aliasHit = [];
      for (var r = 0; r < ALLROWS.length; r++) {
        var row = ALLROWS[r], nv = norm(row.ville);
        if (nv === nq) exact.push([row, '']);
        else if (nv.indexOf(nq) === 0) debut.push([row, '']);
        else if (nv.indexOf(nq) >= 0) dedans.push([row, '']);
        else {
          var al = ALIAS[row.cp] || [];
          for (var a = 0; a < al.length; a++) {
            if (norm(al[a]).indexOf(nq) === 0) { aliasHit.push([row, al[a]]); break; }
          }
        }
      }
      // Une commune éclatée en 13 codes (Mons 7000→7034) ne doit pas noyer la liste : une seule
      // ligne par nom de commune, sur son code principal (le plus petit). Les correspondances par
      // ALIAS gardent leur ligne propre — c'est justement là que « Ghlin → 7011 Mons » est utile.
      var all = exact.concat(debut, dedans), vus = {}, groupe = [];
      for (var g = 0; g < all.length; g++) {
        var nom = norm(all[g][0].ville);
        if (vus[nom]) { if (all[g][0].cp < vus[nom].cp) vus[nom].cp = all[g][0].cp; continue; }
        vus[nom] = { cp: all[g][0].cp }; groupe.push(nom);
      }
      for (var h = 0; h < groupe.length && out.length < max; h++) push(vus[groupe[h]].cp, '');
      for (var k = 0; k < aliasHit.length && out.length < max; k++) push(aliasHit[k][0].cp, aliasHit[k][1]);
      return out;
    },
  };

  // ── Composant de saisie ────────────────────────────────────────────────────────────────────
  // Une seule liste déroulante partagée par tous les champs de la page (position fixe calculée
  // depuis le champ actif) : pas de dépendance à la mise en page des formulaires, pas de risque
  // de rognage par un parent en overflow:hidden — piège classique des menus flottants.
  var POP = null, POP_INPUT = null, POP_ITEMS = [], POP_SEL = -1, POP_ONPICK = null;

  function css() {
    if (document.getElementById('ssPostalCss')) return;
    var s = document.createElement('style');
    s.id = 'ssPostalCss';
    s.textContent = [
      '.pc-pop{position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border-strong);',
      'border-radius:var(--r-sm,4px);box-shadow:0 12px 32px rgba(0,0,0,.28);overflow:auto;max-height:min(300px,50vh);padding:2px;}',
      '.pc-opt{display:flex;align-items:baseline;gap:.5rem;width:100%;text-align:left;background:transparent;border:0;',
      'padding:.42rem .6rem;cursor:pointer;color:var(--text);font-size:var(--fs-sm,.875rem);line-height:1.25;border-radius:var(--r-sm,4px);}',
      '.pc-opt:hover,.pc-opt.on{background:var(--surface-3);}',
      '.pc-cp{font-family:var(--font-mono);font-size:var(--fs-xs,.8rem);color:var(--accent-2-ink,var(--accent-2));font-weight:700;min-width:3.1em;}',
      '.pc-city{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.pc-via{color:var(--text-subtle);font-size:var(--fs-2xs,.72rem);}',
      '.pc-prov{color:var(--text-subtle);font-family:var(--font-mono);font-size:var(--fs-2xs,.72rem);white-space:nowrap;}',
    ].join('');
    document.head.appendChild(s);
  }

  function closePop() {
    if (POP) POP.style.display = 'none';
    POP_INPUT = null; POP_ITEMS = []; POP_SEL = -1; POP_ONPICK = null;
  }

  function openPop(input, items, onPick) {
    if (!items.length) { closePop(); return; }
    css();
    if (!POP) {
      POP = document.createElement('div');
      POP.className = 'pc-pop';
      POP.setAttribute('role', 'listbox');
      document.body.appendChild(POP);
      // mousedown plutôt que click : le clic arriverait APRÈS le blur du champ, qui referme la liste.
      POP.addEventListener('mousedown', function (e) {
        var b = e.target.closest('.pc-opt');
        if (!b) return;
        e.preventDefault();
        var i = Number(b.dataset.i);
        if (POP_ONPICK && POP_ITEMS[i]) POP_ONPICK(POP_ITEMS[i]);
        closePop();
      });
    }
    POP_INPUT = input; POP_ITEMS = items; POP_SEL = -1; POP_ONPICK = onPick;
    POP.innerHTML = items.map(function (it, i) {
      return '<button type="button" class="pc-opt" role="option" data-i="' + i + '">'
        + '<span class="pc-cp">' + it.cp + '</span>'
        + '<span class="pc-city">' + escapeHtml(it.ville) + (it.via ? ' <span class="pc-via">· ' + escapeHtml(it.via) + '</span>' : '') + '</span>'
        + (it.prov ? '<span class="pc-prov">' + escapeHtml(it.prov) + '</span>' : '')
        + '</button>';
    }).join('');
    var r = input.getBoundingClientRect();
    POP.style.display = 'block';
    POP.style.left = Math.round(r.left) + 'px';
    POP.style.minWidth = Math.round(r.width) + 'px';
    POP.style.maxWidth = Math.max(260, Math.round(r.width * 2.2)) + 'px';
    // Pas la place en dessous → on ouvre vers le haut plutôt que de sortir de l'écran.
    var h = Math.min(POP.scrollHeight, window.innerHeight * 0.5, 300);
    var dessous = window.innerHeight - r.bottom;
    if (dessous < h + 12 && r.top > dessous) POP.style.top = Math.round(r.top - h - 4) + 'px';
    else POP.style.top = Math.round(r.bottom + 4) + 'px';
    input.setAttribute('aria-expanded', 'true');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function move(d) {
    if (!POP || POP.style.display === 'none') return;
    var opts = POP.querySelectorAll('.pc-opt');
    if (!opts.length) return;
    POP_SEL = (POP_SEL + d + opts.length) % opts.length;
    for (var i = 0; i < opts.length; i++) opts[i].classList.toggle('on', i === POP_SEL);
    opts[POP_SEL].scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('keydown', function (e) {
    if (!POP_INPUT || document.activeElement !== POP_INPUT) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Escape') { closePop(); }
    else if (e.key === 'Enter') {
      // Entrée ne valide QUE si une ligne est surlignée : sinon on ne vole pas la soumission du formulaire.
      if (POP_SEL >= 0 && POP_ITEMS[POP_SEL]) { e.preventDefault(); POP_ONPICK && POP_ONPICK(POP_ITEMS[POP_SEL]); closePop(); }
    }
  }, true);
  document.addEventListener('mousedown', function (e) {
    if (POP && POP.style.display !== 'none' && !e.target.closest('.pc-pop') && e.target !== POP_INPUT) closePop();
  });
  window.addEventListener('scroll', function () { if (POP_INPUT) closePop(); }, true);

  // ── Marquage « rempli automatiquement » ────────────────────────────────────────────────────
  // On ne réécrit JAMAIS par-dessus une saisie manuelle : seule une valeur que NOUS avons posée
  // (ou un champ vide) peut être remplacée. Nicolas doit pouvoir écrire un lieu-dit à la main.
  function setAuto(elm, val) {
    if (!elm) return;
    elm.value = val;
    elm.dataset.ssAuto = '1';
    elm.dispatchEvent(new Event('input', { bubbles: true }));
    elm.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function libre(elm) { return !elm || !elm.value.trim() || elm.dataset.ssAuto === '1'; }

  /**
   * Deux champs séparés (Code postal · Ville) — clients.html, simulateur.html, terrain.html.
   * Sens 1 : 4 chiffres saisis → la ville se remplit.
   * Sens 2 : ville saisie et reconnue sans ambiguïté → le code postal se remplit.
   * Les deux champs proposent la même liste ; choisir une ligne remplit les deux d'un coup.
   */
  SSPostal.bindPair = function (cpEl, villeEl) {
    if (!cpEl || !villeEl || cpEl.dataset.ssPostal) return;
    cpEl.dataset.ssPostal = '1'; villeEl.dataset.ssPostal = '1';
    cpEl.setAttribute('inputmode', 'numeric');           // clavier chiffres sur iPhone (Mode Terrain)
    cpEl.setAttribute('autocomplete', 'postal-code');
    villeEl.setAttribute('autocomplete', 'address-level2');
    if (!cpEl.placeholder) cpEl.placeholder = 'ex. 1440';
    if (!villeEl.placeholder) villeEl.placeholder = 'ex. Braine-le-Château';

    // On écrit le nom que Nicolas a cherché : s'il a tapé « Ghlin » et choisi « 7011 Mons · Ghlin »,
    // l'adresse doit dire Ghlin — c'est la localité postale, celle qu'attend bpost.
    var pick = function (it) {
      cpEl.value = it.cp; cpEl.dataset.ssAuto = '';
      setAuto(villeEl, it.via || it.ville);
      cpEl.dispatchEvent(new Event('change', { bubbles: true }));
    };

    cpEl.addEventListener('input', function () {
      var cp = cpEl.value.trim();
      if (/^\d{4}$/.test(cp)) {
        var v = SSPostal.city(cp);
        // On respecte une sous-localité correcte déjà saisie (Wauthier-Braine pour 1440).
        if (v && (libre(villeEl) || !SSPostal.matches(cp, villeEl.value))) setAuto(villeEl, v);
      } else if (!cp && villeEl.dataset.ssAuto === '1') {
        setAuto(villeEl, '');
      }
      openPop(cpEl, SSPostal.suggest(cp, 8), pick);
    });
    villeEl.addEventListener('input', function () {
      villeEl.dataset.ssAuto = '';
      openPop(villeEl, SSPostal.suggest(villeEl.value, 8), pick);
    });
    // À la sortie du champ Ville : si le nom désigne une seule commune, on complète le code postal.
    villeEl.addEventListener('change', function () {
      var cp = SSPostal.codeOf(villeEl.value);
      if (cp && !cpEl.value.trim()) {
        cpEl.value = cp;
        cpEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    [cpEl, villeEl].forEach(function (e) { e.addEventListener('blur', function () { setTimeout(closePop, 120); }); });
  };

  /**
   * Champ unique « Code postal + ville » — rdv.html.
   * Taper « 1440 » complète en « 1440 Braine-le-Château » ; taper « Braine » propose les codes.
   */
  SSPostal.bindCombined = function (elm) {
    if (!elm || elm.dataset.ssPostal) return;
    elm.dataset.ssPostal = '1';
    var pick = function (it) {
      elm.value = it.cp + ' ' + (it.via || it.ville);
      elm.dispatchEvent(new Event('input', { bubbles: true }));
      elm.dispatchEvent(new Event('change', { bubbles: true }));
      try { elm.setSelectionRange(elm.value.length, elm.value.length); } catch (e) {}
    };
    var dernier = '';
    elm.addEventListener('input', function () {
      var v = elm.value, efface = v.length < dernier.length;
      dernier = v;
      // Complétion silencieuse UNIQUEMENT sur « 1440 » seul et jamais pendant un effacement,
      // sinon on se battrait avec le curseur de Nicolas pendant qu'il corrige.
      if (!efface && /^\d{4}$/.test(v.trim())) {
        var ville = SSPostal.city(v.trim());
        if (ville) {
          elm.value = v.trim() + ' ' + ville;
          dernier = elm.value;   // sinon le prochain effacement serait pris pour une frappe
          try { elm.setSelectionRange(elm.value.length, elm.value.length); } catch (e) {}
          elm.dispatchEvent(new Event('change', { bubbles: true }));
          closePop(); return;
        }
      }
      openPop(elm, SSPostal.suggest(v, 8), pick);
    });
    elm.addEventListener('blur', function () { setTimeout(closePop, 120); });
  };

  /** Repli automatique : branche tous les champs marqués data-postal="cp|ville|combi". */
  SSPostal.autoBind = function (root) {
    root = root || document;
    var cp = root.querySelector('[data-postal="cp"]'), v = root.querySelector('[data-postal="ville"]');
    if (cp && v) SSPostal.bindPair(cp, v);
    Array.prototype.forEach.call(root.querySelectorAll('[data-postal="combi"]'), SSPostal.bindCombined);
  };

  SSPostal.count = function () { build(); return ALLROWS.length; };
  window.SSPostal = SSPostal;
})();
