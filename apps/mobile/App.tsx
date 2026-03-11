import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate } from '@matchprop/shared';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MatchProp Mobile</Text>
      <Text style={styles.subtitle}>Hoy: {formatDate(new Date())}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
  },
});
