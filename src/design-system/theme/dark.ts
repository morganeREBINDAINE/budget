import { lightTheme, type Theme } from './light';

// TODO thème sombre : non défini en v1 (app.json force userInterfaceStyle "light").
// Redéfinir ici `colors` et `categoryColors` quand le design sombre sera fourni.
export const darkTheme: Theme = { ...lightTheme, scheme: 'dark' };
