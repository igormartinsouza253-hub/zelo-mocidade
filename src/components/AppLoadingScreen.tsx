type AppLoadingScreenProps = {
  label?: string;
};

export function AppLoadingScreen({ label = "Carregando o Zelo" }: AppLoadingScreenProps) {
  return (
    <div className="app-loading-surface" role="status" aria-label={label}>
      <div className="app-loading-card">
        <div className="app-loading-mark" aria-hidden="true">
          <span className="app-loading-mark-base" />
          <span className="app-loading-mark-fill" />
        </div>
        <p className="app-loading-label">{label}</p>
      </div>
    </div>
  );
}
