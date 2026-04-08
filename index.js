const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];
for (let folder of vect_foldere) {
    let caleFolder = path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder);
    }
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

let obGlobal = { obErori: null };

function valideazaErori(caleJson) {
    if (!fs.existsSync(caleJson)) {
        console.error("EROARE CRITICA: Fisierul erori.json nu exista! Aplicatia se va inchide.");
        process.exit(); 
    }

    let jsonString = fs.readFileSync(caleJson, 'utf-8');

    let obiecteInterne = jsonString.match(/\{[^{}]+\}/g) || [];
    let radacinaJson = jsonString.replace(/\{[^{}]+\}/g, "{}");
    
    let vectorVerificare = [...obiecteInterne, radacinaJson];
    for (let bloc of vectorVerificare) {
        let regexChei = /"([^"]+)"\s*:/g;
        let match;
        let cheiGasite = [];
        while ((match = regexChei.exec(bloc)) !== null) {
            let cheie = match[1];
            if (cheiGasite.includes(cheie)) {
                console.error(`AVERTISMENT (0.2): Proprietatea "${cheie}" este specificata de mai multe ori in acelasi obiect din erori.json!`);
            }
            cheiGasite.push(cheie);
        }
    }

    let obErori;
    try {
        obErori = JSON.parse(jsonString);
    } catch (e) {
        console.error("EROARE CRITICA: Fisierul erori.json nu este un JSON valid!");
        process.exit();
    }

    if (!obErori.info_erori || !obErori.cale_baza || !obErori.eroare_default) {
        console.error("EROARE (0.025): Lipseste una dintre proprietatile principale: info_erori, cale_baza sau eroare_default.");
    }

    if (obErori.eroare_default) {
        if (!obErori.eroare_default.titlu || !obErori.eroare_default.text || !obErori.eroare_default.imagine) {
            console.error("EROARE (0.025): Pentru eroare_default lipseste titlul, textul sau imaginea.");
        }
    }

    if (obErori.cale_baza) {
        let folderRelativ = obErori.cale_baza.startsWith('/') ? obErori.cale_baza.substring(1) : obErori.cale_baza;
        let caleFolderErori = path.join(__dirname, folderRelativ);
        if (!fs.existsSync(caleFolderErori)) {
            console.error(`EROARE (0.025): Folderul specificat in cale_baza ("${obErori.cale_baza}") nu exista pe disk.`);
        }
    }

    if (obErori.info_erori && Array.isArray(obErori.info_erori)) {
        let identificatoriVazuti = {};
        obErori.info_erori.forEach(eroare => {
            let id = eroare.identificator;
            if (identificatoriVazuti[id]) {
                identificatoriVazuti[id].push(eroare);
            } else {
                identificatoriVazuti[id] = [eroare];
            }
        });

        for (let id in identificatoriVazuti) {
            if (identificatoriVazuti[id].length > 1) {
                console.error(`EROARE (0.15): Identificatorul "${id}" apare de mai multe ori! Detaliile duplicatelor:`);
                identificatoriVazuti[id].forEach(err => {
                    let { identificator, ...rest } = err;
                    console.error("   -> Proprietati:", JSON.stringify(rest));
                });
            }
        }
    }

    let eroriDeVerificat = [];
    if (obErori.eroare_default) eroriDeVerificat.push(obErori.eroare_default);
    if (obErori.info_erori) eroriDeVerificat.push(...obErori.info_erori);

    eroriDeVerificat.forEach(eroare => {
        if (eroare.imagine && obErori.cale_baza) {
            let folderRelativ = obErori.cale_baza.startsWith('/') ? obErori.cale_baza.substring(1) : obErori.cale_baza;
            let caleImagine = path.join(__dirname, folderRelativ, eroare.imagine);
            if (!fs.existsSync(caleImagine)) {
                console.error(`EROARE (0.05): Imaginea "${eroare.imagine}" pentru eroarea "${eroare.titlu || eroare.identificator}" lipseste la calea: ${caleImagine}`);
            }
        }
    });

    return obErori;
}

function initErori() {
    let caleErori = path.join(__dirname, 'erori.json');
    
    let obEroriParsat = valideazaErori(caleErori);
    
    obGlobal.obErori = obEroriParsat;
    
    if(obGlobal.obErori && obGlobal.obErori.info_erori) {
        obGlobal.obErori.info_erori.forEach(eroare => {
            eroare.imagine = obGlobal.obErori.cale_baza + eroare.imagine;
        });
        obGlobal.obErori.eroare_default.imagine = obGlobal.obErori.cale_baza + obGlobal.obErori.eroare_default.imagine;
    }
}

initErori();

function afisareEroare(res, identificator, titlu, text, imagine) {
    let eroare = obGlobal.obErori.info_erori.find(e => e.identificator == identificator);
    
    if (!eroare) {
        let err_default = obGlobal.obErori.eroare_default;
        res.render('pagini/eroare', {
            titlu: titlu || err_default.titlu,
            text: text || err_default.text,
            imagine: imagine || err_default.imagine
        });
    } else {
        if (eroare.status) {
            res.status(identificator);
        }
        res.render('pagini/eroare', {
            titlu: titlu || eroare.titlu,
            text: text || eroare.text,
            imagine: imagine || eroare.imagine
        });
    }
}

app.get("/favicon.ico", (req, res) => {
    res.sendFile(path.join(__dirname, "resurse/imagini/favicon/favicon.ico"));
});

app.get(/\.ejs$/, (req, res) => {
    afisareEroare(res, 400);
});

app.get(/^\/resurse\/.*\/$/, (req, res) => {
    afisareEroare(res, 403);
});

app.get(['/', '/index', '/home'], (req, res) => {
    res.render('pagini/index', { ip: req.ip });
});

app.get('/despre', (req, res) => {
    res.render('pagini/despre', { ip: req.ip });
});

app.get(/^\/(.*)$/, (req, res) => {
    let numePagina = req.params[0]; 
    
    if (!numePagina) {
        afisareEroare(res, 404);
        return;
    }

    if (numePagina.includes('.')) {
        afisareEroare(res, 404);
        return;
    }

    res.render('pagini/' + numePagina, { ip: req.ip }, function(err, rezRandare) {
        if (err) {
            if (err.message.includes("Failed to lookup view")) {
                afisareEroare(res, 404);
            } else {
                afisareEroare(res);
            }
        } else {
            res.send(rezRandare);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Serverul a pornit si asculta pe http://localhost:${PORT}`);
});