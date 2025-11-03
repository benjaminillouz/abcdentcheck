/**
 * Script de test local pour la Cloud Function ABCDent Checker
 * Usage: node test-local.js
 */

require('dotenv').config();
const axios = require('axios');

// Configuration pour le test local
const LOCAL_FUNCTION_URL = 'http://localhost:8080';

async function testLocalFunction() {
  console.log('🧪 Test de la Cloud Function en local...\n');
  
  try {
    // Vérifier que les variables d'environnement sont définies
    if (!process.env.ABCDENT_USERNAME || !process.env.ABCDENT_PASSWORD) {
      console.error('❌ Erreur : Les variables ABCDENT_USERNAME et ABCDENT_PASSWORD doivent être définies dans le fichier .env');
      process.exit(1);
    }
    
    console.log('📍 URL de test :', LOCAL_FUNCTION_URL);
    console.log('👤 Username :', process.env.ABCDENT_USERNAME);
    console.log('🔑 Password :', '*'.repeat(process.env.ABCDENT_PASSWORD.length));
    console.log('\n⏳ Appel de la fonction...\n');
    
    // Appeler la fonction locale
    const startTime = Date.now();
    const response = await axios.get(LOCAL_FUNCTION_URL, {
      timeout: 120000 // 2 minutes de timeout
    });
    const duration = Date.now() - startTime;
    
    // Afficher les résultats
    console.log('✅ Réponse reçue en', (duration / 1000).toFixed(2), 'secondes\n');
    console.log('📊 Données de la réponse :');
    console.log('----------------------------');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('----------------------------\n');
    
    // Analyser le résultat
    if (response.data.success) {
      console.log('✅ Test réussi !');
      console.log(`📌 Statut de l'annonce : ${response.data.status}`);
      console.log(`📮 Webhook envoyé : ${response.data.webhook_sent ? 'OUI' : 'NON'}`);
      
      if (response.data.status === 'OK') {
        console.log('🎯 L\'annonce a été trouvée sur ABCDent');
      } else {
        console.log('ℹ️ L\'annonce n\'a pas été trouvée sur ABCDent');
      }
    } else {
      console.log('⚠️ La fonction a renvoyé un statut d\'échec');
      if (response.data.error) {
        console.log('❌ Erreur :', response.data.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test :');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('La fonction n\'est pas en cours d\'exécution.');
      console.error('Lancez d\'abord : npm run dev');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Timeout - la fonction a mis trop de temps à répondre');
    } else if (error.response) {
      console.error('Statut HTTP :', error.response.status);
      console.error('Données :', error.response.data);
    } else {
      console.error(error.message);
    }
    
    process.exit(1);
  }
}

// Message d'aide
function showHelp() {
  console.log(`
🚀 ABCDent Checker - Test Local
================================

Ce script teste la Cloud Function en local.

Prérequis :
1. Créer un fichier .env avec vos credentials
2. Lancer la fonction locale : npm run dev
3. Dans un autre terminal : node test-local.js

Configuration requise dans .env :
- ABCDENT_USERNAME : Votre email ABCDent
- ABCDENT_PASSWORD : Votre mot de passe ABCDent
  `);
}

// Exécution principale
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
  } else {
    testLocalFunction().catch(console.error);
  }
}

module.exports = { testLocalFunction };
