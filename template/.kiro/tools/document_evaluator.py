#!/usr/bin/env python3
"""
Document Evaluator - 文档质量评估组件

负责分析文档结构和内容，评估质量并识别改进领域
"""

import re
from typing import Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class QualityAssessment:
    """质量评估结果"""
    score: float  # 0-10
    criteria_scores: Dict[str, float] = field(default_factory=dict)
    missing_sections: List[str] = field(default_factory=list)
    incomplete_sections: List[str] = field(default_factory=list)
    issues: List[str] = field(default_factory=list)
    language: str = 'en'


class DocumentEvaluator:
    """
    文档评估器 - 分析文档质量
    
    支持中英文文档评估
    """
    
    def __init__(self):
        self.language = None
    
    def _detect_language(self, content: str) -> str:
        """
        检测文档语言
        返回: 'zh' (中文) 或 'en' (英文)
        """
        # 统计中文字符数量
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', content))
        # 统计英文单词数量
        english_words = len(re.findall(r'\b[a-zA-Z]+\b', content))
        
        # 如果中文字符超过100个，判定为中文
        if chinese_chars > 100:
            return 'zh'
        # 如果英文单词超过中文字符的3倍，判定为英文
        elif english_words > chinese_chars * 3:
            return 'en'
        # 默认中文
        return 'zh'

    def assess_requirements_quality(self, content: str, language: Optional[str] = None) -> QualityAssessment:
        """评估 Requirements 文档质量 (0-10) - 支持中英文"""
        lang = language or self._detect_language(content)
        self.language = lang
        
        score = 0.0
        criteria_scores = {}
        missing_sections = []
        incomplete_sections = []
        issues = []
        
        if lang == 'zh':
            # 中文评分标准
            # 基础结构检查 (2分)
            structure_score = 0.0
            if "## 1. 概述" in content or "## Introduction" in content:
                structure_score += 0.5
            else:
                missing_sections.append("概述/Introduction")
            
            if "## 2. 用户故事" in content:
                structure_score += 0.5
            else:
                missing_sections.append("用户故事")
            
            if "## 3. 功能需求" in content:
                structure_score += 0.5
            else:
                missing_sections.append("功能需求")
            
            if "## 4. 非功能需求" in content:
                structure_score += 0.5
            else:
                missing_sections.append("非功能需求")
            
            criteria_scores['structure'] = structure_score
            score += structure_score
            
            # EARS 格式检查 (2分)
            ears_patterns = len(re.findall(r'WHEN.*THEN', content, re.IGNORECASE))
            ears_score = min(ears_patterns * 0.2, 2.0)
            criteria_scores['ears_format'] = ears_score
            score += ears_score
            
            if ears_patterns < 5:
                issues.append(f"EARS 格式验收标准较少 (当前 {ears_patterns}，建议 5+)")
            
            # 用户故事质量 (2分)
            user_story_patterns = len(re.findall(r'作为.*我希望.*以便', content))
            user_story_score = min(user_story_patterns * 0.3, 2.0)
            criteria_scores['user_stories'] = user_story_score
            score += user_story_score
            
            if user_story_patterns < 3:
                issues.append(f"用户故事较少 (当前 {user_story_patterns}，建议 3+)")
            
            # 验收标准完整性 (2分)
            acceptance_criteria = len(re.findall(r'\*\*验收标准\*\*:', content))
            acceptance_score = min(acceptance_criteria * 0.4, 2.0)
            criteria_scores['acceptance_criteria'] = acceptance_score
            score += acceptance_score
            
            # 非功能需求覆盖 (1分)
            nfr_keywords = ['性能', '安全', '可用性', '可维护性', '兼容性']
            nfr_coverage = sum(1 for keyword in nfr_keywords if keyword in content)
            nfr_score = min(nfr_coverage * 0.2, 1.0)
            criteria_scores['nfr_coverage'] = nfr_score
            score += nfr_score
            
            missing_nfr = [kw for kw in nfr_keywords if kw not in content]
            if missing_nfr:
                issues.append(f"缺少非功能需求: {', '.join(missing_nfr)}")
            
            # 约束条件 (1分)
            if "约束条件" in content or "限制" in content:
                criteria_scores['constraints'] = 1.0
                score += 1.0
            else:
                criteria_scores['constraints'] = 0.0
                missing_sections.append("约束条件")
        else:
            # 英文评分标准
            # 基础结构检查 (2分)
            structure_score = 0.0
            if "## Introduction" in content or "## Overview" in content:
                structure_score += 0.5
            else:
                missing_sections.append("Introduction/Overview")
            
            if "## Glossary" in content or "## Terminology" in content:
                structure_score += 0.5
            else:
                missing_sections.append("Glossary")
            
            if "## Requirements" in content or "## Functional Requirements" in content:
                structure_score += 0.5
            else:
                missing_sections.append("Requirements")
            
            if "Non-functional" in content or "Non-Functional" in content:
                structure_score += 0.5
            else:
                missing_sections.append("Non-functional Requirements")
            
            criteria_scores['structure'] = structure_score
            score += structure_score
            
            # EARS 格式检查 (2分)
            ears_patterns = len(re.findall(r'WHEN.*THEN|IF.*THEN', content, re.IGNORECASE))
            ears_score = min(ears_patterns * 0.15, 2.0)
            criteria_scores['ears_format'] = ears_score
            score += ears_score
            
            if ears_patterns < 5:
                issues.append(f"Few EARS-format acceptance criteria (current {ears_patterns}, target 5+)")
            
            # 用户故事质量 (2分)
            user_story_patterns = len(re.findall(r'As a.*I want.*So that', content, re.IGNORECASE))
            user_story_score = min(user_story_patterns * 0.25, 2.0)
            criteria_scores['user_stories'] = user_story_score
            score += user_story_score
            
            if user_story_patterns < 3:
                issues.append(f"Few user stories (current {user_story_patterns}, target 3+)")
            
            # 验收标准完整性 (2分)
            acceptance_criteria = len(re.findall(r'Acceptance Criteria|#### Acceptance Criteria', content, re.IGNORECASE))
            acceptance_score = min(acceptance_criteria * 0.3, 2.0)
            criteria_scores['acceptance_criteria'] = acceptance_score
            score += acceptance_score
            
            # 非功能需求覆盖 (1分)
            nfr_keywords = ['performance', 'security', 'usability', 'maintainability', 'compatibility', 'scalability']
            nfr_coverage = sum(1 for keyword in nfr_keywords if keyword.lower() in content.lower())
            nfr_score = min(nfr_coverage * 0.15, 1.0)
            criteria_scores['nfr_coverage'] = nfr_score
            score += nfr_score
            
            missing_nfr = [kw for kw in nfr_keywords if kw.lower() not in content.lower()]
            if len(missing_nfr) > 3:
                issues.append(f"Missing non-functional requirements: {', '.join(missing_nfr[:3])}")
            
            # 约束条件 (1分)
            if "constraint" in content.lower() or "limitation" in content.lower():
                criteria_scores['constraints'] = 1.0
                score += 1.0
            else:
                criteria_scores['constraints'] = 0.0
                missing_sections.append("Constraints")
        
        return QualityAssessment(
            score=min(score, 10.0),
            criteria_scores=criteria_scores,
            missing_sections=missing_sections,
            incomplete_sections=incomplete_sections,
            issues=issues,
            language=lang
        )

    def assess_design_quality(self, design_content: str, requirements_content: str, language: Optional[str] = None) -> QualityAssessment:
        """评估 Design 文档质量 (0-10) - 支持中英文"""
        lang = language or self._detect_language(design_content)
        self.language = lang
        
        score = 0.0
        criteria_scores = {}
        missing_sections = []
        incomplete_sections = []
        issues = []
        
        if lang == 'zh':
            # 中文评分标准
            # 基础结构检查 (2分)
            structure_score = 0.0
            if "## 1. 系统概述" in design_content or "## 1. 概述" in design_content or "## Overview" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("系统概述")
            
            if "## 2. 架构设计" in design_content or "## Architecture" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("架构设计")
            
            if "## 3. 组件设计" in design_content or "## Components" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("组件设计")
            
            if "## 4. 数据流设计" in design_content or "## 4. 接口设计" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("数据流/接口设计")
            
            criteria_scores['structure'] = structure_score
            score += structure_score
            
            # 需求追溯性检查 (2分)
            req_references = len(re.findall(r'需求\s*\d+\.\d+|Requirements?\s*\d+\.\d+|Requirement\s+\d+\.\d+', design_content, re.IGNORECASE))
            traceability_score = min(req_references * 0.2, 2.0)
            criteria_scores['traceability'] = traceability_score
            score += traceability_score
            
            if req_references < 3:
                issues.append(f"需求追溯较少 (当前 {req_references}，建议 3+)")
            
            # 架构图和设计图 (1.5分)
            diagram_indicators = len(re.findall(r'```mermaid|```plantuml|架构图|设计图|流程图', design_content))
            diagram_score = min(diagram_indicators * 0.5, 1.5)
            criteria_scores['diagrams'] = diagram_score
            score += diagram_score
            
            if diagram_indicators == 0:
                missing_sections.append("架构图/设计图")
            
            # 技术选型说明 (1.5分)
            tech_keywords = ['技术选型', '技术栈', '框架选择', '数据库', 'API', '协议']
            tech_coverage = sum(1 for keyword in tech_keywords if keyword in design_content)
            tech_score = min(tech_coverage * 0.25, 1.5)
            criteria_scores['technology'] = tech_score
            score += tech_score
            
            # 非功能需求设计 (1.5分)
            nfr_design = ['性能设计', '安全设计', '可扩展性', '容错机制', '监控']
            nfr_coverage = sum(1 for keyword in nfr_design if keyword in design_content)
            nfr_score = min(nfr_coverage * 0.3, 1.5)
            criteria_scores['nfr_design'] = nfr_score
            score += nfr_score
            
            # 接口定义完整性 (1.5分)
            interface_indicators = len(re.findall(r'接口定义|API\s*设计|数据结构|参数说明', design_content))
            interface_score = min(interface_indicators * 0.4, 1.5)
            criteria_scores['interfaces'] = interface_score
            score += interface_score
        else:
            # 英文评分标准
            # 基础结构检查 (2分)
            structure_score = 0.0
            if "## Overview" in design_content or "## Introduction" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("Overview/Introduction")
            
            if "## Architecture" in design_content or "## System Architecture" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("Architecture")
            
            if "## Components" in design_content or "## Component" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("Components")
            
            if "## Interface" in design_content or "## Data Flow" in design_content or "## API" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("Interfaces/Data Flow")
            
            criteria_scores['structure'] = structure_score
            score += structure_score
            
            # 需求追溯性检查 (2分)
            req_references = len(re.findall(r'Requirement[s]?\s+\d+\.\d+|_Requirements:\s+\d+\.\d+|Validates:\s+Requirements?\s+\d+\.\d+', design_content, re.IGNORECASE))
            traceability_score = min(req_references * 0.15, 2.0)
            criteria_scores['traceability'] = traceability_score
            score += traceability_score
            
            if req_references < 3:
                issues.append(f"Few requirements references (current {req_references}, target 3+)")
            
            # 架构图和设计图 (1.5分)
            diagram_indicators = len(re.findall(r'```mermaid|```plantuml|```diagram|Architecture Diagram|Component Diagram', design_content, re.IGNORECASE))
            diagram_score = min(diagram_indicators * 0.4, 1.5)
            criteria_scores['diagrams'] = diagram_score
            score += diagram_score
            
            if diagram_indicators == 0:
                missing_sections.append("Architecture/Design Diagrams")
            
            # 技术选型说明 (1.5分)
            tech_keywords = ['technology', 'framework', 'database', 'api', 'protocol', 'stack', 'library']
            tech_coverage = sum(1 for keyword in tech_keywords if keyword.lower() in design_content.lower())
            tech_score = min(tech_coverage * 0.2, 1.5)
            criteria_scores['technology'] = tech_score
            score += tech_score
            
            # 非功能需求设计 (1.5分)
            nfr_design = ['performance', 'security', 'scalability', 'fault tolerance', 'monitoring', 'error handling']
            nfr_coverage = sum(1 for keyword in nfr_design if keyword.lower() in design_content.lower())
            nfr_score = min(nfr_coverage * 0.25, 1.5)
            criteria_scores['nfr_design'] = nfr_score
            score += nfr_score
            
            # 接口定义完整性 (1.5分)
            interface_indicators = len(re.findall(r'Interface|API\s+Design|Data\s+Model|Data\s+Structure|Parameter', design_content, re.IGNORECASE))
            interface_score = min(interface_indicators * 0.3, 1.5)
            criteria_scores['interfaces'] = interface_score
            score += interface_score
        
        return QualityAssessment(
            score=min(score, 10.0),
            criteria_scores=criteria_scores,
            missing_sections=missing_sections,
            incomplete_sections=incomplete_sections,
            issues=issues,
            language=lang
        )
    
    def assess_tasks_quality(self, content: str) -> QualityAssessment:
        """评估 Tasks 文档完整性"""
        # 匹配不同状态的任务
        completed_tasks = re.findall(r'- \[x\] (.+)', content)
        in_progress_tasks = re.findall(r'- \[-\] (.+)', content)
        not_started_tasks = re.findall(r'- \[ \] (.+)', content)
        queued_tasks = re.findall(r'- \[~\] (.+)', content)
        
        total_count = len(completed_tasks) + len(in_progress_tasks) + len(not_started_tasks) + len(queued_tasks)
        completed_count = len(completed_tasks)
        
        # 基于完成率计算分数
        completion_rate = (completed_count / total_count * 100) if total_count > 0 else 0
        score = completion_rate / 10.0  # 转换为 0-10 分
        
        issues = []
        if total_count == 0:
            issues.append("No tasks found in document")
        elif completion_rate < 50:
            issues.append(f"Low completion rate: {completion_rate:.1f}%")
        
        return QualityAssessment(
            score=min(score, 10.0),
            criteria_scores={'completion_rate': score},
            missing_sections=[],
            incomplete_sections=[],
            issues=issues,
            language='en'
        )
