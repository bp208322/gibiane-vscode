import {
  Memento,
  Disposable,
  TextDocument,
  Position,
  CompletionList,
  DocumentSymbol,
  CompletionItemProvider,
  CancellationToken,
  Hover,
  Location,
  DefinitionLink,
  SemanticTokens,
  SemanticTokensBuilder,
  CompletionItemKind,
  WorkspaceEdit,
  TextEdit,
} from "vscode";
import { GBItem } from "./gbItems";
import { importBuiltins } from "./gbImportBuiltins";
import { GB_LEGENDS } from "../gbIndex";

export class FileItems {
  items: Map<string, GBItem>;
  uri: string;
  provideHover: any;

  constructor(uri: string) {
    this.items = importBuiltins();
    this.uri = uri;
  }

  add(id: string, completion: GBItem) {
    this.items.set(id, completion);
  }

  get(id: string): GBItem {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  getAllItems(): GBItem[] {
    let items = [];
    for (let item of this.items.values()) {
      items.push(item);
    }
    return items;
  }
}

export class ItemsRepository implements CompletionItemProvider, Disposable {
  public items: Map<string, FileItems>;
  private globalState: Memento;

  constructor(globalState?: Memento) {
    this.items = new Map();
    this.globalState = globalState;
  }

  public provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): CompletionList {
    let completionsList: CompletionList = new CompletionList();
    completionsList.items = this.items
      .get(document.uri.toString())
      .getAllItems()
      .map((e) => e.toCompletionItem());
    return completionsList;
  }

  public async provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Hover> {
    let range = document.getWordRangeAtPosition(position);
    let word = document.getText(range);
    let item = this.items
      .get(document.uri.toString())
      .getAllItems()
      .find((e) => e.name === word.toUpperCase());

    if (item) {
      return item.toHoverItem();
    }

    // Try partial match
    item = this.items
      .get(document.uri.toString())
      .getAllItems()
      .find((e) => word.toUpperCase().startsWith(e.name));
    if (item) {
      return item.toHoverItem();
    }
  }

  public async provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<Location | DefinitionLink[]> {
    let range = document.getWordRangeAtPosition(position);
    let word = document.getText(range);
    let items = this.items.get(document.uri.toString()).getAllItems();
    items = items.filter((e) => e.name === word.toUpperCase());

    if (items.length > 0) {
      return items.map((e) => e.toDefinitionItem());
    }

    // Try partial match
    items = this.items
      .get(document.uri.toString())
      .getAllItems()
      .filter((e) => word.toUpperCase().startsWith(e.name));
    if (items.length > 0) {
      return items.map((e) => e.toDefinitionItem());
    }
  }

  public async provideDocumentSemanticTokens(
    document: TextDocument
  ): Promise<SemanticTokens> {
    const tokensBuilder = new SemanticTokensBuilder(GB_LEGENDS);
    let items = this.items.get(document.uri.toString()).getAllItems();
    for (let item of items) {
      if (item.kind === CompletionItemKind.Variable) {
        tokensBuilder.push(item.range, "variable", ["declaration"]);
        for (let call of item.calls) {
          tokensBuilder.push(call.range, "variable", ["declaration"]);
        }
      }
    }
    return tokensBuilder.build();
  }

  public async provideDocumentSymbols(
    document: TextDocument,
    token: CancellationToken
  ): Promise<DocumentSymbol[]> {
    let items = this.items.get(document.uri.toString()).getAllItems();
    return items
      .filter((e) => e.kind === CompletionItemKind.Variable)
      .map((e) => e.toSymbolItem());
  }

  public async provideRenameEdits(
    document: TextDocument,
    position: Position,
    newName: string,
    token: CancellationToken
  ): Promise<WorkspaceEdit> {
    let range = document.getWordRangeAtPosition(position);
    let word = document.getText(range);
    let items = this.items.get(document.uri.toString()).getAllItems();
    let item = items.find(
      (e) =>
        e.name === word.toUpperCase() && e.kind === CompletionItemKind.Variable
    );
    if (item === undefined) {
      return undefined;
    }
    let textedits: TextEdit[] = item.calls.map((e) => {
      return new TextEdit(e.range, newName);
    });
    // Add the definition as well
    textedits.push(new TextEdit(item.range, newName));

    let edit = new WorkspaceEdit();
    edit.set(document.uri, textedits);
    return edit;
  }

  public dispose() {}
}
