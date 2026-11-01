import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  try {
    const sampleDir = path.join(process.cwd(), "data", "sample");
    const sourceA = fs.readFileSync(path.join(sampleDir, "sourceA.txt"), "utf-8");
    const sourceB = fs.readFileSync(path.join(sampleDir, "sourceB.txt"), "utf-8");
    const sourceC = fs.readFileSync(path.join(sampleDir, "sourceC.txt"), "utf-8");

    return NextResponse.json({
      question: "What should I verify before applying for this scholarship?",
      sources: [
        {
          type: "text",
          name: "Source A (Official Scholarship Portal)",
          text: sourceA,
        },
        {
          type: "text",
          name: "Source B (STEM Grant Watch Blog - Oct 2026)",
          text: sourceB,
        },
        {
          type: "text",
          name: "Source C (Archived Grant Guidelines 2023-2024)",
          text: sourceC,
        },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
