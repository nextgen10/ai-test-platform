/**
 * Reading the Workflow Builder's output back into installable files.
 *
 * The `workflow-builder` pipeline ends with a Markdown document: a heading
 * naming a file path, then a fenced block holding that file's contents, once
 * per generated file. That is a good thing to hand a person — it is also
 * exactly enough structure to hand the Registry API, which is what turns the
 * workflow from "here is some text to copy" into "these agents now exist".
 *
 * Parsing is deliberately forgiving about the *heading* and strict about the
 * *path*: a model reliably writes the path it was told to write, and much less
 * reliably writes the same heading level or backtick style twice running.
 */

/** One file the builder produced, ready to be created in the Registry. */
export interface GeneratedFile {
    /** Repository-relative path exactly as the builder wrote it. */
    path: string;
    /** Entity id, taken from the filename — the same rule the registry uses. */
    id: string;
    kind: 'agent' | 'workflow' | 'skill' | 'prompt';
    /** File contents, from the fenced block that followed the heading. */
    content: string;
}

/**
 * Which hub directory a path belongs to, and how its id is spelled.
 *
 * Anchored on the directory rather than the extension because `.md` alone does
 * not say whether a file is an agent, a skill or a prompt.
 */
const KINDS: { kind: GeneratedFile['kind']; dir: string; suffix: string }[] = [
    { kind: 'agent', dir: 'agents', suffix: '.agent.md' },
    { kind: 'workflow', dir: 'workflows', suffix: '.workflow.yaml' },
    { kind: 'prompt', dir: 'prompts', suffix: '.prompt.md' },
    { kind: 'skill', dir: 'skills', suffix: '/SKILL.md' },
];

/** Same shape the API enforces, so a bad id is rejected here rather than at 400. */
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

function classify(rawPath: string): Pick<GeneratedFile, 'id' | 'kind'> | null {
    // Tolerate a leading ./ or / and any prefix above agent-hub/.
    const path = rawPath.trim().replace(/^\.?\//, '');

    for (const { kind, dir, suffix } of KINDS) {
        const marker = `${dir}/`;
        const at = path.lastIndexOf(marker);
        if (at === -1) continue;

        const tail = path.slice(at + marker.length);
        if (!tail.endsWith(suffix)) continue;

        const id = tail.slice(0, -suffix.length);
        if (!SAFE_ID.test(id)) continue;

        return { id, kind };
    }
    return null;
}

/**
 * Pull every generated file out of the builder's Markdown output.
 *
 * Returns them in the order they appear, which is also the order the builder
 * writes them: the workflow first, then its agents. Callers that install need
 * the opposite order — see {@link installOrder}.
 */
export function parseGeneratedFiles(markdown: string): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const lines = markdown.split('\n');

    let pending: Pick<GeneratedFile, 'id' | 'kind'> & { path: string } | null = null;
    let fence: string | null = null;
    let buffer: string[] = [];

    for (const line of lines) {
        if (fence !== null) {
            // Inside a block: only a fence of at least the opening length ends
            // it, so ``` inside a ````-fenced block does not close it early.
            const closing = line.trimStart().match(/^(`{3,}|~{3,})\s*$/);
            if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) {
                if (pending) {
                    files.push({ ...pending, content: buffer.join('\n').trim() + '\n' });
                    pending = null;
                }
                fence = null;
                buffer = [];
            } else {
                buffer.push(line);
            }
            continue;
        }

        const opening = line.trimStart().match(/^(`{3,}|~{3,})/);
        if (opening) {
            // A block with no path heading before it is illustrative prose, not
            // a file. Consume it so its contents cannot be mistaken for one.
            fence = opening[1];
            buffer = [];
            continue;
        }

        // A heading naming a path. The backticks are what the builder is told to
        // use, but a heading without them is still unambiguous.
        const heading = line.match(/^#{1,6}\s+`?([^`\s]+\.(?:agent\.md|workflow\.yaml|prompt\.md)|[^`\s]*SKILL\.md)`?\s*$/);
        if (heading) {
            const classified = classify(heading[1]);
            pending = classified ? { ...classified, path: heading[1].trim() } : null;
        }
    }

    // Two files claiming the same path is a builder mistake; the later one wins,
    // matching what a person copying top to bottom would end up with.
    const deduped = new Map<string, GeneratedFile>();
    for (const file of files) deduped.set(`${file.kind}:${file.id}`, file);
    return [...deduped.values()];
}

/**
 * Order files so each one can be created without a dangling reference.
 *
 * The registry validates a workflow's `agents:` list on write and refuses one
 * naming an agent that does not exist yet. Installing a generated bundle in the
 * order it was written would therefore fail on the very first call, so
 * everything a workflow can depend on goes first.
 */
export function installOrder(files: GeneratedFile[]): GeneratedFile[] {
    const rank: Record<GeneratedFile['kind'], number> = {
        skill: 0,
        agent: 1,
        prompt: 2,
        workflow: 3,
    };
    return [...files].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** The workflow id in a generated bundle, if it produced one. */
export function bundleWorkflowId(files: GeneratedFile[]): string | null {
    return files.find((f) => f.kind === 'workflow')?.id ?? null;
}
