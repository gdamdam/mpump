import { useEngine } from "./hooks/useEngine";
import { Layout } from "./components/Layout";

export function App() {
  const { state, catalog, command } = useEngine();
  return <Layout state={state} catalog={catalog} command={command} />;
}
