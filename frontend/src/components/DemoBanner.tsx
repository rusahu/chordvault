import { useDemo } from '../context/DemoContext';

export function DemoBanner() {
  const { demoMode } = useDemo();
  if (!demoMode) return null;

  return (
    <div className="demo-banner">
      Demo instance &middot; Login: <strong>demo</strong> / <strong>demopass123</strong> &middot; Data resets every 6 hours
    </div>
  );
}
