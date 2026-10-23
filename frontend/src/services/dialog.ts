import { Alert, AlertButton, Platform } from 'react-native';

/**
 * Comme Alert.alert, mais aussi sur le web : react-native-web ignore Alert.alert (rien ne
 * s'affiche et aucun bouton n'est jamais appelé). Sur le web, les boîtes du navigateur
 * prennent le relais : confirm() quand il y a un choix (« OK » = le bouton qui n'est pas
 * « cancel »), alert() sinon.
 */
export const showAlert = (title: string, message?: string, buttons?: AlertButton[]): void => {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const cancel = buttons?.find((b) => b.style === 'cancel');
  const action = buttons?.find((b) => b.style !== 'cancel');
  if (cancel && action) {
    if (window.confirm(text)) action.onPress?.();
    else cancel.onPress?.();
    return;
  }
  window.alert(text);
  (action ?? cancel)?.onPress?.();
};
