// Point d'entrée : le suivi des erreurs démarre avant tout le reste (src/lib/monitoring.ts), puis
// la tâche de fond est définie avant le routeur, car Android peut lancer l'app sans écran
// uniquement pour l'exécuter (src/features/sync/backgroundSync.ts).
import '@/lib/monitoring';
import '@/features/sync/backgroundSync';
import 'expo-router/entry';
