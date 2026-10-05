# Déploiement Netlify + Gemini API

## 1. Déployer sur Netlify

1. Connectez votre dépôt GitHub à Netlify (ou utilisez `netlify deploy`).
2. Netlify détecte automatiquement `netlify.toml` :
   - Build command : `npm run build`
   - Publish directory : `dist`
3. Ajoutez les variables d'environnement dans Netlify (Site settings → Environment variables) :

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme Supabase |

Ces valeurs se trouvent dans votre fichier `.env` local.

## 2. Configurer la clé API Gemini

La fonction edge `analyze-homework` utilise l'API Gemini pour la pré-correction automatique.

### Ajouter la clé dans Supabase

1. Obtenez une clé API sur [Google AI Studio](https://aistudio.google.com/apikey).
2. Dans le dashboard Supabase : **Project Settings → Edge Functions → Secrets**.
3. Ajoutez une variable nommée `GEMINI_API_KEY` avec votre clé.

Sans cette clé, l'edge function utilise un mode simulé (notes aléatoires) pour les tests.

## 3. Redéployer l'edge function après modification

Si vous modifiez `supabase/functions/analyze-homework/index.ts`, la fonction est redéployée automatiquement via les outils Bolt. Aucune action manuelle n'est nécessaire.
