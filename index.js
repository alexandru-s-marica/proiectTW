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

function initErori() {
    let continut = fs.readFileSync(path.join(__dirname, 'erori.json'), 'utf-8');
    obGlobal.obErori = JSON.parse(continut);
    
    obGlobal.obErori.info_erori.forEach(eroare => {
        eroare.imagine = obGlobal.obErori.cale_baza + eroare.imagine;
    });
    obGlobal.obErori.eroare_default.imagine = obGlobal.obErori.cale_baza + obGlobal.obErori.eroare_default.imagine;
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