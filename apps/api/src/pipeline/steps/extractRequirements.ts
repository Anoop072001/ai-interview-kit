import { z } from "zod";
import { generateStructured } from "../../llm/client.js";
import { requirementKindSchema, requirementPrioritySchema, type Requirement } from "@aik/shared";
import { makeIdSequence } from "../../utils/ids.js";
import { wrapUntrusted, SAFETY_INSTRUCTION } from "../../utils/promptSafety.js";

const extractionOutputSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  location: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(
    z.object({
      text: z.string().min(1),
      kind: requirementKindSchema,
      priority: requirementPrioritySchema,
    })
  ),
});

export interface ExtractedRole {
  title: string;
  seniority: string;
  location: string;
  responsibilities: string[];
  requirements: Requirement[];
}

const SYSTEM_PROMPT = `You are an expert technical recruiter extracting structured facts from a single job description.
${SAFETY_INSTRUCTION}

Rules:
- Extract ONLY what the job description actually states or clearly, directly implies. Never invent requirements, seniority, or responsibilities that aren't grounded in the text.
- If the description is thin (a stub with little detail), return a short list — do not pad it with generic/invented requirements. A thin description producing a thin, honest result is correct behaviour.
- priority "must" is for requirements phrased as required/necessary/need (e.g. "5+ years of X", "must have Y"). priority "nice" is for anything phrased as a bonus/preferred/plus (e.g. "bonus points for", "nice to have", "familiarity with Z is a plus"). Do not default everything to "must" — read the wording.
- kind "technical" for hard skills/tools/experience, "behavioural" for soft skills/leadership/collaboration/communication, "domain" for industry/business-domain knowledge.
- seniority and location: infer only if stated or strongly implied; otherwise use an empty string.`;

export async function extractRequirements(jd: string): Promise<ExtractedRole> {
  const prompt = `Extract the role title, seniority, location, key responsibilities, and every distinct requirement (technical, behavioural, or domain) from this job description.

${wrapUntrusted("job_description", jd)}

Return JSON: { "title": string, "seniority": string, "location": string, "responsibilities": string[], "requirements": [{ "text": string, "kind": "technical"|"behavioural"|"domain", "priority": "must"|"nice" }] }`;

  const result = await generateStructured(extractionOutputSchema, SYSTEM_PROMPT, prompt);

  const nextId = makeIdSequence("r");
  const requirements: Requirement[] = result.requirements.map((r) => ({
    id: nextId(),
    text: r.text,
    kind: r.kind,
    priority: r.priority,
  }));

  return {
    title: result.title,
    seniority: result.seniority,
    location: result.location,
    responsibilities: result.responsibilities,
    requirements,
  };
}
