import { buildCodeContextInlineChipLabel, type CodeContextSelection } from "~/lib/codeContext";
import { ContextChipShell } from "../contextChipParts";
import { PierreEntryIcon } from "./PierreEntryIcon";
import { readResolvedThemeModeFromDocument } from "../../theme";

interface CodeContextInlineChipProps {
  selection: Pick<CodeContextSelection, "filePath" | "lineStart" | "lineEnd">;
  tooltipText: string;
}

export function CodeContextInlineChip(props: CodeContextInlineChipProps) {
  const { selection, tooltipText } = props;
  const theme = readResolvedThemeModeFromDocument();
  const label = buildCodeContextInlineChipLabel(selection);

  return (
    <ContextChipShell
      kind="file"
      icon={<PierreEntryIcon pathValue={selection.filePath} kind="file" theme={theme} />}
      label={label}
      tooltip={tooltipText}
    />
  );
}
