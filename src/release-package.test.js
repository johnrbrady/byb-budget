import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import packageJson from "../package.json";

const root = path.resolve(process.cwd());
const appDir = path.join(root, "truenas-app", "ix-dev", "community", "byb-budget");

function pngDimensions(file) {
  const data = fs.readFileSync(file);
  expect(data.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test("PWA manifest names real square any and maskable icons", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "public", "manifest.json"), "utf8"));
  expect(manifest.icons).toHaveLength(4);
  expect(new Set(manifest.icons.map((icon) => icon.src)).size).toBe(4);

  for (const icon of manifest.icons) {
    expect(["any", "maskable"]).toContain(icon.purpose);
    const declared = Number(icon.sizes.split("x")[0]);
    expect(pngDimensions(path.join(root, "public", icon.src.slice(1)))).toEqual({ width: declared, height: declared });
  }
});

test("TrueNAS community package is complete and pinned to the release image", () => {
  const required = [
    "app.yaml",
    "app_migrations.yaml",
    "item.yaml",
    "ix_values.yaml",
    "questions.yaml",
    "README.md",
    path.join("templates", "docker-compose.yaml"),
    path.join("templates", "test_values", "basic-values.yaml"),
  ];
  for (const file of required) expect(fs.existsSync(path.join(appDir, file))).toBe(true);

  const app = yaml.load(fs.readFileSync(path.join(appDir, "app.yaml"), "utf8"));
  const values = yaml.load(fs.readFileSync(path.join(appDir, "ix_values.yaml"), "utf8"));
  const questions = yaml.load(fs.readFileSync(path.join(appDir, "questions.yaml"), "utf8"));
  const testValues = yaml.load(fs.readFileSync(path.join(appDir, "templates", "test_values", "basic-values.yaml"), "utf8"));
  const template = fs.readFileSync(path.join(appDir, "templates", "docker-compose.yaml"), "utf8");

  expect(app).toMatchObject({ name: "byb-budget", train: "community", app_version: packageJson.version });
  expect(values.images.image).toEqual({ repository: "ghcr.io/johnrbrady/byb-budget", tag: packageJson.version });
  expect(questions.groups.map((group) => group.name)).toEqual(expect.arrayContaining([
    "Network Configuration", "Storage Configuration", "Resources Configuration",
  ]));
  expect(testValues).toMatchObject({ byb: { session_ttl_hours: 72 }, run_as: { user: 568, group: 568 } });
  expect(template).toContain("c1.set_user");
  expect(template).toContain('c1.add_storage(values.consts.data_path, values.storage.data)');
  expect(template).toContain('c1.healthcheck.set_test("wget"');
  expect(template).toContain('"path": "/api/health"');
  expect(template).not.toContain('"path": "/api/users"');
  expect(template).toContain("tpl.portals.add");
});

test("interim TrueNAS updater discovers instances and recreates instead of restarting", () => {
  const updater = fs.readFileSync(path.join(root, "update-truenas.sh"), "utf8");
  expect(updater).toContain("com.docker.compose.project.config_files");
  expect(updater).toContain('up -d --force-recreate --pull always');
  expect(updater).toContain("TARGET_IMAGE_ID");
  expect(updater).toContain("byb-backup.sh");
  expect(updater).not.toMatch(/docker\s+restart/);
  expect(updater).not.toContain("ix-byb-aleem-byb-aleem-1");
});
