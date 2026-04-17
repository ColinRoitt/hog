export function PendingSubmittersNote({ names }) {
  if (!names?.length) {
    return null;
  }

  return (
    <>
      {" "}
      Still waiting on <strong>{names.join(", ")}</strong>.
    </>
  );
}
