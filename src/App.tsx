import { StoreProvider } from "./design/store";
import { Experience } from "./design/Experience";
import "./design/styles.css";
export default function App() {
  return (
    <StoreProvider>
      <Experience />
    </StoreProvider>
  );
}
