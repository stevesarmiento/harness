import type {
  EditorId,
  EnvironmentId,
  ProjectScript,
  ResolvedKeybindingsConfig,
  ThreadId,
} from "@t3tools/contracts";
import { FileDownIcon, FolderClosedIcon, GitForkIcon, HashIcon, Trash2Icon } from "lucide-react";
import { IconEllipsis as EllipsisIcon } from "symbols-react";

import { useT3ProjectFileScripts } from "~/hooks/useT3ProjectFileScripts";

import { HeaderIconActionButton } from "../HeaderIconActionButton";
import { MessageCopyIcon, SidebarArchiveIcon } from "../icons/custom";
import ProjectScriptsControl, {
  type NewProjectScriptInput,
  type ProjectScriptActionResult,
} from "../ProjectScriptsControl";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { OpenInMenuItems } from "./OpenInPicker";

interface ChatHeaderActionsMenuProps {
  routeKind: "server" | "draft";
  activeThreadEnvironmentId: EnvironmentId;
  activeThreadId: ThreadId;
  activeProjectCwd: string | null;
  openInCwd: string | null;
  activeProjectScripts: ReadonlyArray<ProjectScript> | undefined;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  availableEditors: ReadonlyArray<EditorId>;
  workspaceRoot: string | null;
  showOpenIn: boolean;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<ProjectScriptActionResult>;
  onUpdateProjectScript: (
    scriptId: string,
    input: NewProjectScriptInput,
  ) => Promise<ProjectScriptActionResult>;
  onDeleteProjectScript: (scriptId: string) => Promise<ProjectScriptActionResult>;
  onExportThread?: (() => void) | undefined;
  onCopyThreadAsMarkdown?: (() => void) | undefined;
  onCopyWorkspacePath?: (() => void) | undefined;
  onCopyThreadId?: (() => void) | undefined;
  onForkThread?: (() => void) | undefined;
  onArchiveThread?: (() => void) | undefined;
  onDeleteThread?: (() => void) | undefined;
}

export function resolveChatHeaderActionVisibility(input: {
  routeKind: "server" | "draft";
  hasProjectActions: boolean;
  hasOpenInCwd: boolean;
  showOpenIn: boolean;
  hasWorkspaceRoot: boolean;
}) {
  const hasOpenInActions = input.showOpenIn && input.hasOpenInCwd;
  const hasWorkspaceActions = input.hasProjectActions || hasOpenInActions;
  return {
    hasOpenInActions,
    hasWorkspaceActions,
    showDurableThreadActions: input.routeKind === "server",
    showWorkspacePath: input.hasWorkspaceRoot,
  } as const;
}

export function ChatHeaderActionsMenu({
  routeKind,
  activeThreadEnvironmentId,
  activeProjectCwd,
  openInCwd,
  activeProjectScripts,
  preferredScriptId,
  keybindings,
  availableEditors,
  workspaceRoot,
  showOpenIn,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
  onExportThread,
  onCopyThreadAsMarkdown,
  onCopyWorkspacePath,
  onCopyThreadId,
  onForkThread,
  onArchiveThread,
  onDeleteThread,
}: ChatHeaderActionsMenuProps) {
  const fileScripts = useT3ProjectFileScripts(
    activeThreadEnvironmentId,
    activeProjectScripts ? activeProjectCwd : null,
  );
  const hasProjectActions = activeProjectScripts !== undefined;
  const visibility = resolveChatHeaderActionVisibility({
    routeKind,
    hasProjectActions,
    hasOpenInCwd: openInCwd !== null,
    showOpenIn,
    hasWorkspaceRoot: workspaceRoot !== null,
  });
  const { hasOpenInActions, hasWorkspaceActions } = visibility;
  const hasDurableThreadActions =
    routeKind === "server" &&
    Boolean(
      onExportThread ||
      onCopyThreadAsMarkdown ||
      onCopyThreadId ||
      onForkThread ||
      onArchiveThread ||
      onDeleteThread,
    );
  const hasThreadActions = hasDurableThreadActions || Boolean(workspaceRoot && onCopyWorkspacePath);

  return (
    // Fork: TODO the git commit/push/PR menu items lived here; upstream's GitActionsControl
    // dropped its menu-items render mode and imperative handle (git now lives in ThreadDetailsPanel).
    <Menu>
      <MenuTrigger
        render={<HeaderIconActionButton aria-label="More actions" title="More actions" />}
      >
        <EllipsisIcon className="size-3 rotate-90" aria-hidden />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-56 max-w-[calc(100vw-1rem)]" keepMounted>
        {hasWorkspaceActions ? (
          <MenuGroup>
            <MenuGroupLabel>Workspace</MenuGroupLabel>
            {hasProjectActions ? (
              <ProjectScriptsControl
                renderMode="menu-items"
                scripts={activeProjectScripts}
                fileScripts={fileScripts}
                keybindings={keybindings}
                preferredScriptId={preferredScriptId}
                onRunScript={onRunProjectScript}
                onAddScript={onAddProjectScript}
                onUpdateScript={onUpdateProjectScript}
                onDeleteScript={onDeleteProjectScript}
              />
            ) : null}
            {hasProjectActions && hasOpenInActions ? <MenuSeparator /> : null}
            {hasOpenInActions ? (
              <OpenInMenuItems
                environmentId={activeThreadEnvironmentId}
                keybindings={keybindings}
                availableEditors={availableEditors}
                openInCwd={openInCwd}
              />
            ) : null}
          </MenuGroup>
        ) : null}

        {hasWorkspaceActions && hasThreadActions ? <MenuSeparator /> : null}
        {hasThreadActions ? (
          <MenuGroup>
            <MenuGroupLabel>Thread</MenuGroupLabel>
            {routeKind === "server" && onExportThread ? (
              <MenuItem onClick={onExportThread}>
                <FileDownIcon />
                Export as Markdown
              </MenuItem>
            ) : null}
            {routeKind === "server" && onCopyThreadAsMarkdown ? (
              <MenuItem onClick={onCopyThreadAsMarkdown}>
                <MessageCopyIcon />
                Copy thread as Markdown
              </MenuItem>
            ) : null}
            {workspaceRoot && onCopyWorkspacePath ? (
              <MenuItem onClick={onCopyWorkspacePath}>
                <FolderClosedIcon />
                Copy workspace path
              </MenuItem>
            ) : null}
            {routeKind === "server" && onCopyThreadId ? (
              <MenuItem onClick={onCopyThreadId}>
                <HashIcon />
                Copy thread ID
              </MenuItem>
            ) : null}
            {routeKind === "server" && onForkThread ? (
              <MenuItem onClick={onForkThread}>
                <GitForkIcon />
                Fork thread
              </MenuItem>
            ) : null}
            {routeKind === "server" && onArchiveThread ? (
              <MenuItem onClick={onArchiveThread}>
                <SidebarArchiveIcon />
                Archive
              </MenuItem>
            ) : null}
            {routeKind === "server" && onDeleteThread ? (
              <>
                <MenuSeparator />
                <MenuItem variant="destructive" onClick={onDeleteThread}>
                  <Trash2Icon />
                  Delete
                </MenuItem>
              </>
            ) : null}
          </MenuGroup>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
