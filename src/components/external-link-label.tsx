import { ExternalLink } from "lucide-react";

export function ExternalLinkLabel({ text }: { text: string }) {
  const characters = Array.from(text);
  const finalCharacter = characters.pop();

  return (
    <>
      {characters.join("")}
      <span className="external-link-tail">
        {finalCharacter}
        <ExternalLink aria-hidden="true" />
      </span>
    </>
  );
}
