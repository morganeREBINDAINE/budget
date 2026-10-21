// Point d'entrée : la tâche de fond est définie avant le routeur, car Android peut lancer l'app
// sans écran uniquement pour l'exécuter (src/features/sync/backgroundSync.ts).
import '@/features/sync/backgroundSync';
import 'expo-router/entry';
