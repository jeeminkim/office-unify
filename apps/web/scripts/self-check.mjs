import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const counters = {
  pass: 0,
  warn: 0,
  fail: 0,
};

function logPass(message) {
  counters.pass += 1;
  console.log(`[PASS] ${message}`);
}

function logWarn(message) {
  counters.warn += 1;
  console.log(`[WARN] ${message}`);
}

function logFail(message) {
  counters.fail += 1;
  console.log(`[FAIL] ${message}`);
}

function readJson(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf-8");
  return JSON.parse(raw);
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf-8");
}

function checkRequiredFiles() {
  const requiredFiles = [
    "README.md",
    "package.json",
    "app/page.tsx",
    "app/api/generate/route.ts",
    "hooks/useGenerate.ts",
    "lib/storage.ts",
    "lib/providers/gemini.ts",
    "tsconfig.json",
    "next.config.ts",
  ];

  for (const file of requiredFiles) {
    if (fileExists(file)) {
      logPass(`필수 파일 존재: ${file}`);
    } else {
      logFail(`필수 파일 누락: ${file}`);
    }
  }
}

function checkPackageScripts() {
  const pkgPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    logFail("package.json 파일이 없어 scripts 점검을 진행할 수 없습니다.");
    return;
  }

  let pkg;
  try {
    pkg = readJson(pkgPath);
    logPass("package.json JSON 파싱 성공");
  } catch (error) {
    logFail(`package.json JSON 파싱 실패: ${error.message}`);
    return;
  }

  const requiredScripts = ["dev", "build", "start", "lint", "typecheck", "selfcheck"];
  const optionalScripts = ["clean:win"];
  const scripts = pkg.scripts || {};

  for (const scriptName of requiredScripts) {
    if (typeof scripts[scriptName] === "string" && scripts[scriptName].trim() !== "") {
      logPass(`scripts.${scriptName} 확인`);
    } else {
      logFail(`scripts.${scriptName} 누락`);
    }
  }

  for (const scriptName of optionalScripts) {
    if (typeof scripts[scriptName] === "string" && scripts[scriptName].trim() !== "") {
      logPass(`scripts.${scriptName} 확인 (권장)`);
    } else {
      logWarn(`scripts.${scriptName} 없음 (Windows 정리 스크립트 권장)`);
    }
  }
}

function checkConfigFiles() {
  if (fileExists("tsconfig.json")) {
    try {
      const tsconfig = readJson(path.join(rootDir, "tsconfig.json"));
      if (tsconfig?.compilerOptions?.paths?.["@/*"]) {
        logPass("tsconfig.json 경로 alias(@/*) 확인");
      } else {
        logWarn("tsconfig.json에 @/* alias가 없습니다.");
      }
    } catch (error) {
      logFail(`tsconfig.json 파싱 실패: ${error.message}`);
    }
  }

  if (fileExists("next.config.ts") || fileExists("next.config.js") || fileExists("next.config.mjs")) {
    logPass("Next.js 설정 파일 존재");
  } else {
    logFail("Next.js 설정 파일(next.config.*)이 없습니다.");
  }
}

function checkStorageKeys() {
  const storagePath = "lib/storage.ts";
  if (!fileExists(storagePath)) {
    logFail("lib/storage.ts가 없어 localStorage key 점검을 진행할 수 없습니다.");
    return;
  }

  const source = readText(storagePath);
  const expectedKeys = [
    "STORAGE_KEY_SETTINGS",
    "STORAGE_KEY_DRAFT",
    "STORAGE_KEY_RECENT",
    "STORAGE_KEY_FEEDBACK",
  ];

  for (const keyName of expectedKeys) {
    if (source.includes(keyName)) {
      logPass(`localStorage key 명세 확인: ${keyName}`);
    } else {
      logFail(`localStorage key 명세 누락: ${keyName}`);
    }
  }

  const expectedLiteralKeys = [
    "dev_assistant_settings",
    "dev_assistant_draft",
    "dev_assistant_recent",
    "dev_assistant_feedback",
  ];

  for (const key of expectedLiteralKeys) {
    if (source.includes(key)) {
      logPass(`localStorage key 문자열 확인: ${key}`);
    } else {
      logWarn(`localStorage key 문자열 미확인: ${key}`);
    }
  }
}

function checkProjectShape() {
  const requiredDirs = ["app", "components", "hooks", "lib"];

  for (const dir of requiredDirs) {
    const fullPath = path.join(rootDir, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      logPass(`핵심 디렉터리 확인: ${dir}/`);
    } else {
      logFail(`핵심 디렉터리 누락: ${dir}/`);
    }
  }
}

function printSummary() {
  console.log("\n================ SELF-CHECK SUMMARY ================");
  console.log(`PASS: ${counters.pass}`);
  console.log(`WARN: ${counters.warn}`);
  console.log(`FAIL: ${counters.fail}`);
  console.log("====================================================");

  if (counters.fail > 0) {
    console.log("\n실패 항목이 있습니다. 아래를 우선 확인하세요:");
    console.log("- 필수 파일 경로 및 파일명 오탈자");
    console.log("- package.json scripts 정의");
    console.log("- tsconfig/next.config 존재 여부");
    console.log("- lib/storage.ts의 localStorage key 상수 정의");
    process.exitCode = 1;
  } else {
    console.log("\n기본 온보딩 self-check를 통과했습니다.");
    if (counters.warn > 0) {
      console.log("경고 항목은 운영 안정성을 위해 후속 점검을 권장합니다.");
    }
  }
}

function run() {
  console.log("[INFO] dev_support lightweight self-check 시작");
  console.log(`[INFO] root: ${rootDir}\n`);

  checkRequiredFiles();
  checkPackageScripts();
  checkConfigFiles();
  checkStorageKeys();
  checkProjectShape();
  printSummary();
}

run();
