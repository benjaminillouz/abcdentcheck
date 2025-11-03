const functions = require('@google-cloud/functions-framework');
const puppeteer = require('puppeteer');
const axios = require('axios');

// Configuration avec sélecteurs améliorés pour ABCDent
const CONFIG = {
  LOGIN_URL: 'https://www.abcdent.pro/connexion',
  TARGET_URL: 'https://www.abcdent.pro/mon_compte/classifieds?s=published',
  WEBHOOK_URL: 'https://n8n.cemedis.app/webhook/d8fabe02-3a4f-4778-b2af-c291af88a731',
  USERNAME: process.env.ABCDENT_USERNAME || '',
  PASSWORD: process.env.ABCDENT_PASSWORD || '',
  HEADLESS: process.env.NODE_ENV === 'production' ? 'new' : false
};

// Sélecteurs CSS améliorés avec fallbacks
const SELECTORS = {
  // Connexion - plusieurs alternatives
  USERNAME_INPUTS: [
    'input[name="login"]',
    'input[name="username"]',
    'input[name="email"]',
    'input[type="email"]',
    '#login',
    '#username',
    '#email',
    'input[placeholder*="email" i]',
    'input[placeholder*="identifiant" i]'
  ],
  
  PASSWORD_INPUTS: [
    'input[name="password"]',
    'input[type="password"]',
    '#password',
    'input[placeholder*="password" i]',
    'input[placeholder*="mot de passe" i]'
  ],
  
  LOGIN_BUTTONS: [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Connexion")',
    'button:has-text("Se connecter")',
    'button:has-text("Login")',
    'a.btn:has-text("Connexion")',
    '*[class*="submit"]',
    '*[class*="login-btn"]'
  ],
  
  // Element cible avec plusieurs méthodes de recherche
  TARGET_HREF: '/annonces/352084-recrutement-chirurgien-dentiste-75-77-91-92-94-h-f',
  TARGET_TEXT: 'Recrutement chirurgien dentiste 75 77 91 92 94 h/f',
  TARGET_ID: '352084'
};

/**
 * Fonction utilitaire pour trouver un élément avec plusieurs sélecteurs
 */
async function findElement(page, selectors, timeout = 5000) {
  for (const selector of selectors) {
    try {
      const element = await page.waitForSelector(selector, { timeout, visible: true });
      if (element) {
        console.log(`✓ Élément trouvé avec le sélecteur : ${selector}`);
        return element;
      }
    } catch (e) {
      // Continuer avec le sélecteur suivant
    }
  }
  return null;
}

/**
 * Fonction améliorée de recherche d'annonce
 */
async function findAnnonce(page) {
  console.log('Recherche de l\'annonce avec plusieurs méthodes...');
  
  // Méthode 1 : Recherche par href exact
  const method1 = await page.evaluate((targetHref) => {
    const links = document.querySelectorAll('a');
    for (let link of links) {
      if (link.href && link.href.includes(targetHref)) {
        return { found: true, method: 'href_exact', text: link.textContent.trim() };
      }
    }
    return { found: false };
  }, SELECTORS.TARGET_HREF);
  
  if (method1.found) {
    console.log(`✓ Annonce trouvée par href exact : ${method1.text}`);
    return true;
  }
  
  // Méthode 2 : Recherche par texte
  const method2 = await page.evaluate((targetText) => {
    const links = document.querySelectorAll('a');
    for (let link of links) {
      const text = link.textContent.trim().toLowerCase();
      const target = targetText.toLowerCase();
      if (text.includes(target) || text.replace(/\s+/g, ' ') === target.replace(/\s+/g, ' ')) {
        return { found: true, method: 'text_match', href: link.href };
      }
    }
    return { found: false };
  }, SELECTORS.TARGET_TEXT);
  
  if (method2.found) {
    console.log(`✓ Annonce trouvée par texte : ${method2.href}`);
    return true;
  }
  
  // Méthode 3 : Recherche par ID dans l'URL
  const method3 = await page.evaluate((targetId) => {
    const links = document.querySelectorAll('a[href*="/annonces/"]');
    for (let link of links) {
      if (link.href && link.href.includes(targetId)) {
        return { found: true, method: 'id_match', text: link.textContent.trim() };
      }
    }
    return { found: false };
  }, SELECTORS.TARGET_ID);
  
  if (method3.found) {
    console.log(`✓ Annonce trouvée par ID : ${method3.text}`);
    return true;
  }
  
  // Méthode 4 : Recherche flexible avec mots-clés
  const method4 = await page.evaluate(() => {
    const keywords = ['recrutement', 'chirurgien', 'dentiste', '75', '77', '91', '92', '94'];
    const links = document.querySelectorAll('a');
    
    for (let link of links) {
      const text = link.textContent.toLowerCase();
      let matchCount = 0;
      
      for (let keyword of keywords) {
        if (text.includes(keyword)) {
          matchCount++;
        }
      }
      
      // Si au moins 5 mots-clés correspondent
      if (matchCount >= 5) {
        return { found: true, method: 'keyword_match', text: link.textContent.trim(), matchCount };
      }
    }
    return { found: false };
  });
  
  if (method4.found) {
    console.log(`✓ Annonce trouvée par mots-clés (${method4.matchCount} correspondances) : ${method4.text}`);
    return true;
  }
  
  console.log('✗ Annonce non trouvée avec aucune méthode');
  return false;
}

/**
 * Fonction principale de la Cloud Function
 */
functions.http('checkAbcdentAnnonce', async (req, res) => {
  let browser = null;
  let status = 'KO';
  let error = null;
  let details = {};
  
  try {
    console.log('🚀 Démarrage de la vérification ABCDent...');
    console.log(`📅 Date : ${new Date().toISOString()}`);
    
    // Validation des credentials
    if (!CONFIG.USERNAME || !CONFIG.PASSWORD) {
      throw new Error('Les credentials ABCDENT_USERNAME et ABCDENT_PASSWORD sont requis');
    }
    
    // Configuration Puppeteer optimisée pour Cloud Functions
    const puppeteerOptions = {
      headless: CONFIG.HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    };
    
    // Lancement du navigateur
    console.log('🌐 Lancement du navigateur...');
    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    
    // Configuration avancée de la page
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Intercepter les requêtes pour optimiser les performances
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      // Bloquer les ressources non essentielles
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Étape 1 : Navigation vers la page de connexion
    console.log('📍 Navigation vers la page de connexion...');
    const loginResponse = await page.goto(CONFIG.LOGIN_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    if (!loginResponse.ok()) {
      throw new Error(`Impossible d'accéder à la page de connexion : ${loginResponse.status()}`);
    }
    
    // Attendre un peu pour que la page se charge
    await page.waitForTimeout(2000);
    
    // Étape 2 : Trouver et remplir les champs de connexion
    console.log('🔍 Recherche des champs de connexion...');
    
    const usernameField = await findElement(page, SELECTORS.USERNAME_INPUTS);
    if (!usernameField) {
      throw new Error('Impossible de trouver le champ nom d\'utilisateur');
    }
    
    const passwordField = await findElement(page, SELECTORS.PASSWORD_INPUTS);
    if (!passwordField) {
      throw new Error('Impossible de trouver le champ mot de passe');
    }
    
    // Remplir les champs
    console.log('✏️ Saisie des credentials...');
    await usernameField.click();
    await page.keyboard.type(CONFIG.USERNAME, { delay: 100 });
    
    await passwordField.click();
    await page.keyboard.type(CONFIG.PASSWORD, { delay: 100 });
    
    // Trouver et cliquer sur le bouton de connexion
    console.log('🔐 Tentative de connexion...');
    const loginButton = await findElement(page, SELECTORS.LOGIN_BUTTONS);
    
    if (loginButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        loginButton.click()
      ]);
    } else {
      // Essayer d'envoyer le formulaire avec Enter
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.keyboard.press('Enter')
      ]);
    }
    
    // Vérifier la connexion
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log(`📍 URL actuelle : ${currentUrl}`);
    
    if (currentUrl.includes('/connexion') || currentUrl.includes('login')) {
      // Vérifier s'il y a un message d'erreur
      const errorMessage = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('.error, .alert-danger, .message-error, [class*="error"]');
        for (let elem of errorElements) {
          if (elem.textContent) return elem.textContent.trim();
        }
        return null;
      });
      
      throw new Error(`Échec de connexion. ${errorMessage || 'Vérifiez les credentials.'}`);
    }
    
    console.log('✅ Connexion réussie');
    details.login_success = true;
    
    // Étape 3 : Navigation vers la page des annonces
    console.log('📄 Navigation vers la page des annonces...');
    await page.goto(CONFIG.TARGET_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Attendre le chargement complet
    await page.waitForTimeout(3000);
    
    // Compter le nombre d'annonces trouvées
    const annonceCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/annonces/"]').length;
    });
    console.log(`📊 Nombre d'annonces trouvées sur la page : ${annonceCount}`);
    details.total_annonces = annonceCount;
    
    // Étape 4 : Recherche de l'annonce spécifique
    const annonceFound = await findAnnonce(page);
    status = annonceFound ? 'OK' : 'KO';
    
    console.log(`📌 Résultat final : ${status}`);
    details.annonce_found = annonceFound;
    
    // Capture d'écran si demandé
    if (process.env.CAPTURE_SCREENSHOT === 'true') {
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: true 
      });
      details.screenshot_captured = true;
      console.log('📸 Screenshot capturé');
    }
    
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    error = err.message;
    status = 'KO';
    details.error_type = err.constructor.name;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🌐 Navigateur fermé');
    }
  }
  
  // Envoi du résultat au webhook
  try {
    console.log(`📮 Envoi du résultat "${status}" au webhook...`);
    
    const webhookPayload = {
      status: status,
      timestamp: new Date().toISOString(),
      url_checked: CONFIG.TARGET_URL,
      details: details,
      error: error
    };
    
    const webhookResponse = await axios.post(CONFIG.WEBHOOK_URL, webhookPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('✅ Webhook envoyé avec succès');
    
    res.status(200).json({
      success: true,
      status: status,
      webhook_sent: true,
      webhook_response_status: webhookResponse.status,
      timestamp: new Date().toISOString(),
      details: details,
      error: error
    });
    
  } catch (webhookError) {
    console.error('❌ Erreur webhook :', webhookError.message);
    
    res.status(200).json({
      success: false,
      status: status,
      webhook_sent: false,
      webhook_error: webhookError.message,
      timestamp: new Date().toISOString(),
      details: details,
      error: error
    });
  }
});
