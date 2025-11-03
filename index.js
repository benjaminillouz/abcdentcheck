const functions = require('@google-cloud/functions-framework');
const puppeteer = require('puppeteer');
const axios = require('axios');

// Configuration
const CONFIG = {
  LOGIN_URL: 'https://www.abcdent.pro/connexion', // URL de connexion à ajuster si nécessaire
  TARGET_URL: 'https://www.abcdent.pro/mon_compte/classifieds?s=published',
  WEBHOOK_URL: 'https://n8n.cemedis.app/webhook/d8fabe02-3a4f-4778-b2af-c291af88a731',
  USERNAME: process.env.ABCDENT_USERNAME || '',
  PASSWORD: process.env.ABCDENT_PASSWORD || '',
  HEADLESS: process.env.NODE_ENV === 'production' ? 'new' : false
};

// Sélecteurs CSS
const SELECTORS = {
  // Sélecteurs pour la page de connexion - à ajuster selon la structure réelle
  USERNAME_INPUT: 'input[name="username"], input[name="email"], input[type="email"], #username, #email',
  PASSWORD_INPUT: 'input[name="password"], input[type="password"], #password',
  LOGIN_BUTTON: 'button[type="submit"], input[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter")',
  
  // Sélecteur pour l'élément à détecter
  TARGET_ELEMENT: 'a[href="/annonces/352084-recrutement-chirurgien-dentiste-75-77-91-92-94-h-f"]'
};

/**
 * Fonction principale de la Cloud Function
 */
functions.http('checkAbcdentAnnonce', async (req, res) => {
  let browser = null;
  let status = 'KO';
  let error = null;
  
  try {
    console.log('Démarrage de la vérification...');
    
    // Validation des credentials
    if (!CONFIG.USERNAME || !CONFIG.PASSWORD) {
      throw new Error('Les credentials ABCDENT_USERNAME et ABCDENT_PASSWORD doivent être définis dans les variables d\'environnement');
    }
    
    // Configuration de Puppeteer pour Cloud Functions
    const puppeteerOptions = {
      headless: CONFIG.HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Requis pour Cloud Functions
        '--disable-gpu'
      ]
    };
    
    // Lancement du navigateur
    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    
    // Configuration du viewport et user-agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Étape 1 : Connexion
    console.log('Navigation vers la page de connexion...');
    await page.goto(CONFIG.LOGIN_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Attendre que les champs de connexion soient visibles
    console.log('Recherche des champs de connexion...');
    await page.waitForSelector(SELECTORS.USERNAME_INPUT, { timeout: 10000 });
    await page.waitForSelector(SELECTORS.PASSWORD_INPUT, { timeout: 10000 });
    
    // Saisie des credentials
    console.log('Saisie des credentials...');
    await page.type(SELECTORS.USERNAME_INPUT, CONFIG.USERNAME, { delay: 100 });
    await page.type(SELECTORS.PASSWORD_INPUT, CONFIG.PASSWORD, { delay: 100 });
    
    // Clic sur le bouton de connexion
    console.log('Tentative de connexion...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click(SELECTORS.LOGIN_BUTTON)
    ]);
    
    // Petite pause pour s'assurer que la session est bien établie
    await page.waitForTimeout(2000);
    
    // Vérifier si la connexion a réussi (vérifier qu'on n'est plus sur la page de connexion)
    const currentUrl = page.url();
    if (currentUrl.includes('/connexion') || currentUrl.includes('login')) {
      throw new Error('La connexion semble avoir échoué - vérifiez les credentials');
    }
    
    // Étape 2 : Navigation vers la page cible
    console.log('Navigation vers la page des annonces...');
    await page.goto(CONFIG.TARGET_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Attendre un peu pour que la page se charge complètement
    await page.waitForTimeout(3000);
    
    // Étape 3 : Recherche de l'élément
    console.log('Recherche de l\'annonce spécifique...');
    
    // Méthode 1 : Recherche directe par sélecteur
    const elementExists = await page.$(SELECTORS.TARGET_ELEMENT) !== null;
    
    // Méthode 2 : Recherche par texte si la première méthode échoue
    let textFound = false;
    if (!elementExists) {
      textFound = await page.evaluate(() => {
        const links = document.querySelectorAll('a');
        for (let link of links) {
          if (link.textContent.includes('Recrutement chirurgien dentiste 75 77 91 92 94 h/f') ||
              link.href.includes('/annonces/352084-recrutement-chirurgien-dentiste')) {
            return true;
          }
        }
        return false;
      });
    }
    
    // Déterminer le statut
    status = (elementExists || textFound) ? 'OK' : 'KO';
    console.log(`Résultat de la recherche : ${status}`);
    
    // Capture d'écran pour debug (optionnel)
    if (process.env.CAPTURE_SCREENSHOT === 'true') {
      const screenshot = await page.screenshot({ encoding: 'base64' });
      console.log('Screenshot capturé');
    }
    
  } catch (err) {
    console.error('Erreur lors de l\'exécution :', err);
    error = err.message;
    status = 'KO';
  } finally {
    // Fermeture du navigateur
    if (browser) {
      await browser.close();
    }
  }
  
  // Étape 4 : Envoi du résultat au webhook
  try {
    console.log(`Envoi du résultat "${status}" au webhook...`);
    const webhookResponse = await axios.post(CONFIG.WEBHOOK_URL, {
      status: status,
      timestamp: new Date().toISOString(),
      error: error,
      url_checked: CONFIG.TARGET_URL
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('Webhook appelé avec succès');
    
    // Réponse de la Cloud Function
    res.status(200).json({
      success: true,
      status: status,
      webhook_sent: true,
      timestamp: new Date().toISOString(),
      error: error
    });
    
  } catch (webhookError) {
    console.error('Erreur lors de l\'appel du webhook :', webhookError);
    
    res.status(200).json({
      success: false,
      status: status,
      webhook_sent: false,
      webhook_error: webhookError.message,
      timestamp: new Date().toISOString(),
      error: error
    });
  }
});

// Export pour tests locaux
if (require.main === module) {
  // Test local
  const testLocal = async () => {
    console.log('Test local de la fonction...');
    const mockReq = {};
    const mockRes = {
      status: (code) => ({
        json: (data) => console.log(`Response [${code}]:`, data)
      })
    };
    
    await functions.http('checkAbcdentAnnonce', mockReq, mockRes);
  };
  
  testLocal().catch(console.error);
}
