function App() {
  const today = new Date().toLocaleDateString('ru-RU');

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
        Physics Billet Trainer работает
      </h1>
      <p className="mt-4 text-sm text-slate-400">{today}</p>
    </div>
  );
}

export default App;
