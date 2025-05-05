import * as vscode from "vscode";

let interval: NodeJS.Timeout | undefined;
let elapsedSeconds = 0;
let statusBarItem: vscode.StatusBarItem;
let activeFilePath: string | undefined;
let globalContext: vscode.ExtensionContext;
let treeProvider: TimeTreeProvider;
let totalSecondsAllFiles = 0;
let sortDescending = true;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function getStoredTime(path: string): number {
  return globalContext.globalState.get<number>(path) ?? 0;
}

function updateStoredTime(path: string, totalSeconds: number): void {
  globalContext.globalState.update(path, totalSeconds);
  treeProvider.refresh();
}

function updateStatusBar(
  filePath: string,
  elapsed: number,
  total: number
): void {
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  statusBarItem.text = `$(watch) ${formatTime(elapsed)}`;
  statusBarItem.tooltip = [
    `🗂 File: ${fileName}`,
    `⏱ Session: ${formatTime(elapsed)}`,
    `📊 Total: ${formatTime(total)}`,
  ].join("\n");
  statusBarItem.color = "#ffc107";
  statusBarItem.show();
}

function startTracking(editor: vscode.TextEditor | undefined): void {
  if (!editor) {
    return;
  }

  const filePath = editor.document.fileName;
  if (filePath === activeFilePath) {
    return;
  }

  activeFilePath = filePath;
  elapsedSeconds = 0;
  clearInterval(interval);

  const previous = getStoredTime(filePath);

  interval = setInterval(() => {
    elapsedSeconds++;
    const total = previous + elapsedSeconds;

    updateStatusBar(filePath, elapsedSeconds, total);
    updateStoredTime(filePath, total);

    if (elapsedSeconds === 1500) {
      vscode.window.showInformationMessage(
        "⏰ 25 minutes passed! Time for a break?"
      );
    }
  }, 1000);
}

class TimeItem extends vscode.TreeItem {
  constructor(public readonly file: string, public readonly seconds: number) {
    super(file.split(/[\\/]/).pop() ?? file);
    this.description = formatTime(seconds);
    this.tooltip = `${file} – ${formatTime(seconds)}`;
    this.contextValue = "timeItem";
  }
}

class TimeTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    const keys = globalContext.globalState.keys();
    const items = keys.map((path) => new TimeItem(path, getStoredTime(path)));

    totalSecondsAllFiles = items.reduce((sum, item) => sum + item.seconds, 0);

    const sorted = items.sort((a, b) =>
      sortDescending ? b.seconds - a.seconds : a.seconds - b.seconds
    );

    const arrow = sortDescending ? "↓" : "↑";
    const totalItem = new vscode.TreeItem(
      `Total ${arrow}: ${formatTime(totalSecondsAllFiles)}`
    );
    totalItem.tooltip = "Sum of all tracked files";
    totalItem.iconPath = new vscode.ThemeIcon("dashboard");
    totalItem.collapsibleState = vscode.TreeItemCollapsibleState.None;

    return [totalItem, ...sorted];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  globalContext = context;

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  context.subscriptions.push(statusBarItem);

  startTracking(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => startTracking(editor))
  );

  context.subscriptions.push({
    dispose: () => {
      clearInterval(interval);
      statusBarItem.dispose();
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "inline-time-tracker.exportTimes",
      async () => {
        const times = globalContext.globalState.keys().reduce((data, path) => {
          data[path] = getStoredTime(path);
          return data;
        }, {} as Record<string, number>);

        const uri = await vscode.window.showSaveDialog({
          filters: { JSON: ["json"] },
          defaultUri: vscode.Uri.file("time-tracker-export.json"),
        });

        if (uri) {
          const content = JSON.stringify(times, null, 2);
          await vscode.workspace.fs.writeFile(
            uri,
            Buffer.from(content, "utf8")
          );
          vscode.window.showInformationMessage(
            "Time data exported successfully."
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("inline-time-tracker.resetTime", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const filePath = editor.document.fileName;
      globalContext.globalState.update(filePath, 0);
      vscode.window.showInformationMessage("Time reset for current file.");
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("inline-time-tracker.showTimes", () => {
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("inline-time-tracker.toggleSort", () => {
      sortDescending = !sortDescending;
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "inline-time-tracker.resetTimeForFile",
      (item: vscode.TreeItem) => {
        if (!(item instanceof TimeItem)) {
          return;
        }
        globalContext.globalState.update(item.file, 0);
        vscode.window.showInformationMessage(`Reset time for ${item.label}`);
        treeProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "inline-time-tracker.exportTimeForFile",
      async (item: vscode.TreeItem) => {
        if (!(item instanceof TimeItem)) {
          return;
        }
        const uri = await vscode.window.showSaveDialog({
          filters: { JSON: ["json"] },
          defaultUri: vscode.Uri.file(`${item.label}-time.json`),
        });

        if (uri) {
          const content = JSON.stringify(
            { [item.file]: getStoredTime(item.file) },
            null,
            2
          );
          await vscode.workspace.fs.writeFile(
            uri,
            Buffer.from(content, "utf8")
          );
          vscode.window.showInformationMessage(
            `Exported time for ${item.label}`
          );
        }
      }
    )
  );

  treeProvider = new TimeTreeProvider();
  vscode.window.registerTreeDataProvider("timeTrackerPanel", treeProvider);
}

export function deactivate(): void {
  clearInterval(interval);
  statusBarItem.dispose();
}
