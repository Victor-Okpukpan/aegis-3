export interface SecurityFinding {
  id: string;
  title: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  content: string;
  summary: string;
  quality_score: number;
  rarity_score: number;
  report_date: Record<string, any>;
  firm_name: string;
  protocol_name: string;
  source_link: string;
  github_link: string;
  tags: string[];
  finders: string[];
}

export interface SecurityReport {
  category: string;
  total_findings: number;
  fetched_at: string;
  findings: SecurityFinding[];
}

export interface AuditFinding {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  description: string;
  line_numbers: number[];
  file_path: string;
  historical_reference?: {
    title: string;
    protocol: string;
    similarity_score: number;
    source_link?: string;
  };
  poc_code?: string;
}

export interface AuditResult {
  id: string;
  repo_url: string;
  system_map: string;
  findings: AuditFinding[];
  created_at: string;
  status: "pending" | "analyzing" | "completed" | "failed";
  files?: Record<string, string>; // Map of file paths to their contents
  flattened_code?: string; // Flattened Solidity code for analysis
}

export interface ArchitectureMap {
  contracts: Array<{
    name: string;
    type: string;
    key_functions: string[];
    interactions: string[];
  }>;
  patterns: string[];
  risk_areas: string[];
}
