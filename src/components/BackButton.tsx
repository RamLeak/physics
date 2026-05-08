interface Props {
  onClick: () => void;
}

export default function BackButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-slate-300 hover:text-slate-100 transition-colors"
    >
      ← Назад
    </button>
  );
}
