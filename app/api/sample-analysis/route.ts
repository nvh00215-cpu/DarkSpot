import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "sample", "analysis.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Sample analysis file not found." }, { status: 404 });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(content);
    return NextResponse.json(json);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
