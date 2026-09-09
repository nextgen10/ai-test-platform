/**
 * Spreadsheet exports.
 *
 * A generated suite is read by test managers, not by this app: the useful form
 * is one row per test case in a workbook they can filter, not JSON. Steps and
 * preconditions are numbered lines inside a single cell so a row stays a row.
 */

import { CATEGORY_LABEL, formatDuration, formatTimestamp } from './api';
import { downloadBlob } from './download';

/**
 * SheetJS, fetched the first time someone exports something.
 *
 * It is ~280 kB and most visits never touch it, so a static import would put
 * the whole library in front of anyone opening the jobs table.
 */
let sheetjs = null;
async function xlsx() {
    if (!sheetjs) sheetjs = await import('xlsx');
    return sheetjs;
}

/** A list as numbered lines in one cell; an em dash when there is nothing. */
function lines(values) {
    if (!Array.isArray(values) || values.length === 0) return '—';
    return values.map((value, index) => `${index + 1}. ${value}`).join('\n');
}

/** Column widths, since SheetJS has no autofit. */
function fit(widths) {
    return widths.map((wch) => ({ wch }));
}

async function write(sheets, filename) {
    const XLSX = await xlsx();
    const book = XLSX.utils.book_new();
    for (const { name, rows, widths } of sheets) {
        const sheet = XLSX.utils.json_to_sheet(rows);
        if (widths) sheet['!cols'] = fit(widths);
        XLSX.utils.book_append_sheet(book, sheet, name);
    }
    const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
    downloadBlob(
        new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        filename,
    );
}

/** A timestamp that sorts and is safe in a filename. */
function stamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

/**
 * A generated test suite as a workbook.
 *
 * Sheet 1 is the cases. Sheet 2 carries the assumptions the analyst recorded,
 * which are part of the deliverable — a case list read without them invites
 * exactly the misreading the assumption was written to prevent.
 */
export async function exportTestSuite(suite, jobId) {
    const cases = suite?.test_cases ?? [];
    if (cases.length === 0) return false;

    const rows = cases.map((testCase) => ({
        'ID': testCase.id,
        'Title': testCase.title,
        'Category': CATEGORY_LABEL[testCase.category] ?? testCase.category,
        'Priority': testCase.priority,
        'Preconditions': lines(testCase.preconditions),
        'Steps': lines(testCase.steps),
        'Expected result': testCase.expected_result,
        'Requirement': testCase.requirement_reference,
    }));

    const sheets = [
        { name: 'Test cases', rows, widths: [12, 46, 14, 10, 40, 60, 46, 20] },
    ];

    const assumptions = suite?.assumptions ?? [];
    if (assumptions.length > 0) {
        sheets.push({
            name: 'Assumptions',
            rows: assumptions.map((text, index) => ({ '#': index + 1, Assumption: text })),
            widths: [6, 100],
        });
    }

    await write(sheets, `test-cases-${jobId || stamp()}.xlsx`);
    return true;
}

/** The job list as a workbook, for reporting on runs outside the platform. */
export async function exportJobs(jobs) {
    if (!jobs?.length) return false;

    const rows = jobs.map((job) => ({
        'Job': job.id,
        'Workflow': job.workflow,
        'Status': job.status,
        'Engine': job.provenance?.engine ?? '—',
        'Created by': job.created_by,
        'Items': job.summary?.total ?? '—',
        'Duration': formatDuration(job.duration_ms),
        'Created': formatTimestamp(job.created_at),
        'Completed': formatTimestamp(job.completed_at),
        'Error': job.error_message ?? '',
    }));

    await write([{ name: 'Jobs', rows, widths: [16, 26, 20, 10, 18, 8, 12, 22, 22, 50] }], `jobs-${stamp()}.xlsx`);
    return true;
}

/** Per-agent cost and duration, as the dashboard shows it. */
export async function exportAgentUsage(agents, days) {
    if (!agents?.length) return false;

    const rows = agents.map((agent) => ({
        'Agent': agent.agent_id,
        'Runs': agent.runs,
        'Failures': agent.failures,
        'Failure rate': `${Math.round((agent.failure_rate ?? 0) * 100)}%`,
        'Retries': agent.retries,
        'Mean duration': formatDuration(agent.mean_duration_ms),
        'Total tokens': agent.total_tokens ?? '—',
        'Cost (USD)': agent.cost_usd ?? '—',
    }));

    await write(
        [{ name: `Agents ${days}d`, rows, widths: [28, 8, 10, 12, 9, 15, 14, 12] }],
        `agent-usage-${days}d-${stamp()}.xlsx`,
    );
    return true;
}
