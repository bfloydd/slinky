export interface ResultAction {
    icon: string;
    label: string;
    onClick: (path: string) => Promise<void>;
}

export interface ResultItem {
    content: string;
    path: string;
    tooltip?: string;
    actions: ResultAction[];
}
