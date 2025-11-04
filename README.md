# POC IA – Graphiques synchronisés + Rapport (React TS Vite)

Une page frontend-only avec 4 graphiques synchronisés (Recharts), édition/filtrage des données, et génération d’un rapport texte via une API Ollama.

## Prérequis
- Node.js 18 LTS

## Installation
```bash
npm install
```

## Démarrer en dev
```bash
# Optionnel: pointer vers une instance Ollama (par ex. locale)
# export VITE_OLLAMA_BASE_URL=http://localhost:11434
# export VITE_OLLAMA_BASE_PATH=/ollama
# Si votre instance nécessite un token
# export VITE_OLLAMA_TOKEN=xxxxx
# export VITE_OLLAMA_AUTH_HEADER=Authorization   # ou X-API-Key
# export VITE_OLLAMA_AUTH_SCHEME=Bearer          # ou vide

npm run dev
```

- L’app est servie sur http://localhost:5173.
- En dev, les requêtes vers `/ollama/*` sont proxifiées vers `VITE_OLLAMA_BASE_URL` (par défaut http://localhost:11434) pour éviter CORS.
- La route utilisée est `POST /api/generate` avec `{ model, prompt, stream? }` et on attend `{ text }` (adaptez `src/lib/ollama.ts` si votre API diffère).
- Le token peut être saisi dans l’UI (panneau Rapport) et mémorisé en localStorage, ou injecté via variables d’environnement.

## Build
```bash
npm run build
npm run preview
```

## Utilisation
- Modifiez les filtres (dates, catégories) dans « Données et filtres ».
- Importez/Exportez le dataset au format JSON.
- Les 4 graphiques se mettent à jour avec les mêmes filtres (survol/zoom synchronisés).
- Entrez le modèle Ollama (ex: `llama3.1:8b`) et, si nécessaire, votre token. Générez le rapport puis téléchargez-le en Markdown.

## Personnalisation
- Types: `src/types.ts`
- Données d’exemple: `src/lib/sampleData.ts`
- Génération du prompt: `src/lib/report.ts`
- Client Ollama: `src/lib/ollama.ts`
- Composants: `src/components/*`
- Proxy dev et CORS: `vite.config.ts`

## Notes
- Ce POC ne contient pas de backend. Tout est exécuté côté navigateur. L’API Ollama doit être accessible depuis le navigateur ou via le proxy dev Vite.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
