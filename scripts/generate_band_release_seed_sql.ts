#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type BandReleaseSeed = {
  projectName: string;
  projectType: "band" | "solo";
  workTitle: string;
  releaseDate: string;
  format: string;
  catalogNumber: string | null;
  distributorName: string | null;
  description: string | null;
  notes: string | null;
};

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = join(ROOT, "sql", "band_release_seed.sql");

const SEEDS: BandReleaseSeed[] = [
  {
    projectName: "BURGER NUDS",
    projectType: "band",
    workTitle: "D★SELDOM 其の6",
    releaseDate: "2003-09-25",
    format: "CD",
    catalogNumber: null,
    distributorName: "新星堂",
    description: null,
    notes: "source_file=rawData/articles/band_burger.md",
  },
  {
    projectName: "BURGER NUDS",
    projectType: "band",
    workTitle: 'WORLD COMPILATION ALBUM "BIRTH vol.1"',
    releaseDate: "2003-10-22",
    format: "CD",
    catalogNumber: "TBCD-1010",
    distributorName: "tearbridge records",
    description: null,
    notes: "source_file=rawData/articles/band_burger.md",
  },
  {
    projectName: "Good Dog Happy Men",
    projectType: "band",
    workTitle: "Quip Sampler CD vol.23",
    releaseDate: "2005-04-15",
    format: "CD",
    catalogNumber: null,
    distributorName: "Quip",
    description: null,
    notes: "source_file=rawData/articles/band_GDHM.md",
  },
  {
    projectName: "Good Dog Happy Men",
    projectType: "band",
    workTitle: "HI-STYLE VOL.10",
    releaseDate: "2005-10-19",
    format: "CD",
    catalogNumber: "HIST-0014",
    distributorName: "HIGHLINE DISC",
    description: null,
    notes: "source_file=rawData/articles/band_GDHM.md",
  },
  {
    projectName: "Good Dog Happy Men",
    projectType: "band",
    workTitle: "Quip Sampler CD vol.27",
    releaseDate: "2006-04-21",
    format: "CD",
    catalogNumber: null,
    distributorName: "Quip",
    description: null,
    notes: "source_file=rawData/articles/band_GDHM.md",
  },
  {
    projectName: "Good Dog Happy Men",
    projectType: "band",
    workTitle: "JUNGLE★LIFE+ Vol.3",
    releaseDate: "2008-09-03",
    format: "Book+DVD",
    catalogNumber: 'YOUTH3003',
    distributorName: 'JUNGLE★LIFE+vanta',
    description: null,
    notes: "source_file=rawData/articles/band_GDHM.md",
  },
  {
    projectName: "門田匡陽 (ソロ名義/2010)",
    projectType: "solo",
    workTitle: 'POPTOP / UNDER FLOWER / ZENiTH COMPILATION Vol.1 "WHAT ABOUT US?"',
    releaseDate: "2011-10-19",
    format: "CD",
    catalogNumber: "ZPOP-002",
    distributorName: "POPTOP",
    description: null,
    notes: "source_file=rawData/articles/band_solo.md",
  },
  {
    projectName: "Poet-type.M",
    projectType: "solo",
    workTitle: "SD√SELDOM vol.3",
    releaseDate: "2015-02-25",
    format: "CD",
    catalogNumber: null,
    distributorName: "新星堂",
    description: null,
    notes: "source_file=rawData/articles/band_PtM.md",
  },
  {
    projectName: "門田匡陽 (ソロ名義/2020-)",
    projectType: "solo",
    workTitle: "Xtalline : 001",
    releaseDate: "2023-07-21",
    format: "Digital",
    catalogNumber: "ENEI:0001",
    distributorName: "Siren for Charlotte",
    description: null,
    notes: "source_file=rawData/articles/band_solo2020.md",
  },
];

function stableUuid(namespace: string, value: string): string {
  const hash = createHash("sha1").update(`mondenDatabase/${namespace}/${value}`).digest("hex");
  const chars = hash.slice(0, 32).split("");
  chars[12] = "5";
  const variant = Number.parseInt(chars[16]!, 16);
  chars[16] = ((variant & 0x3) | 0x8).toString(16);
  return [
    chars.slice(0, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
    chars.slice(16, 20).join(""),
    chars.slice(20, 32).join(""),
  ].join("-");
}

function sqlText(value: string | null): string {
  if (value == null) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

class SqlBuilder {
  readonly lines: string[] = [];

  line(value = ""): void {
    this.lines.push(value);
  }

  projectUpsert(params: { name: string; kind: "band" | "solo" }): string {
    const projectId = stableUuid("project", params.name);
    this.line("INSERT INTO project (id, name, type, description, start_date, end_date)");
    this.line(`VALUES (${sqlText(projectId)}, ${sqlText(params.name)}, ${sqlText(params.kind)}, NULL, NULL, NULL)`);
    this.line("ON CONFLICT (id) DO UPDATE");
    this.line("SET name = EXCLUDED.name,");
    this.line("    type = EXCLUDED.type;");
    this.line();
    return projectId;
  }

  workUpsert(params: { projectId: string; title: string; description: string | null; releasedDate: string | null }): string {
    const workId = stableUuid("work", `${params.projectId}:${params.title}`);
    this.line("INSERT INTO work (id, project_id, title, description, created_date, released_date)");
    this.line(
      `VALUES (${sqlText(workId)}, ${sqlText(params.projectId)}, ${sqlText(params.title)}, ${sqlText(params.description)}, NULL, ${sqlText(params.releasedDate)})`,
    );
    this.line("ON CONFLICT (id) DO UPDATE");
    this.line("SET project_id = EXCLUDED.project_id,");
    this.line("    title = EXCLUDED.title,");
    this.line("    description = COALESCE(work.description, EXCLUDED.description),");
    this.line("    released_date = COALESCE(work.released_date, EXCLUDED.released_date);");
    this.line();
    return workId;
  }

  distributorUpsert(name: string | null): string | null {
    if (!name) return null;
    const distributorId = stableUuid("distributor", name);
    this.line("INSERT INTO distributor (id, name, description)");
    this.line(`VALUES (${sqlText(distributorId)}, ${sqlText(name)}, NULL)`);
    this.line("ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;");
    this.line();
    return distributorId;
  }

  releaseUpsert(params: {
    workId: string;
    format: string;
    catalogNumber: string | null;
    releaseDate: string;
    description: string | null;
    notes: string | null;
    distributorId: string | null;
  }): void {
    const releaseId = stableUuid("release", `${params.workId}:${params.format}:${params.releaseDate}`);
    this.line(
      "INSERT INTO release (id, work_id, format, catalog_number, release_date, release_date_precision, recorded_from, recorded_to, description, notes, distributor_id)",
    );
    this.line(
      `VALUES (${sqlText(releaseId)}, ${sqlText(params.workId)}, ${sqlText(params.format)}, ${sqlText(params.catalogNumber)}, ${sqlText(params.releaseDate)}, NULL, NULL, NULL, ${sqlText(params.description)}, ${sqlText(params.notes)}, ${sqlText(params.distributorId)})`,
    );
    this.line("ON CONFLICT (id) DO UPDATE");
    this.line("SET work_id = EXCLUDED.work_id,");
    this.line("    format = EXCLUDED.format,");
    this.line("    catalog_number = EXCLUDED.catalog_number,");
    this.line("    release_date = EXCLUDED.release_date,");
    this.line("    description = COALESCE(release.description, EXCLUDED.description),");
    this.line("    notes = COALESCE(release.notes, EXCLUDED.notes),");
    this.line("    distributor_id = EXCLUDED.distributor_id;");
    this.line();
  }
}

async function main(): Promise<void> {
  const output = process.argv.includes("--output") ? resolve(process.argv[process.argv.indexOf("--output") + 1] ?? DEFAULT_OUTPUT) : DEFAULT_OUTPUT;
  const builder = new SqlBuilder();

  builder.line("BEGIN;");
  builder.line();

  const projectIds = new Map<string, string>();
  for (const seed of SEEDS) {
    let projectId = projectIds.get(seed.projectName);
    if (!projectId) {
      projectId = builder.projectUpsert({ name: seed.projectName, kind: seed.projectType });
      projectIds.set(seed.projectName, projectId);
    }

    const workId = builder.workUpsert({
      projectId,
      title: seed.workTitle,
      description: seed.description,
      releasedDate: seed.releaseDate,
    });
    const distributorId = builder.distributorUpsert(seed.distributorName);
    builder.releaseUpsert({
      workId,
      format: seed.format,
      catalogNumber: seed.catalogNumber,
      releaseDate: seed.releaseDate,
      description: seed.description,
      notes: seed.notes,
      distributorId,
    });
  }

  builder.line("COMMIT;");
  builder.line();

  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, `${builder.lines.join("\n")}`, "utf8");
}

await main();
