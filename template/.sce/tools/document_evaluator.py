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
        """评估 Requirements 文档质量 (0-10) - 支持中英文，增强评分算法"""
        lang = language or self._detect_language(content)
        self.language = lang
        
        score = 0.0
        criteria_scores = {}
        missing_sections = []
        incomplete_sections = []
        issues = []
        
        if lang == 'zh':
            # 中文评分标准 - 增强版
            # 基础结构检查 (2分) - 更严格的检查
            structure_score = 0.0
            
            # 检查概述/Introduction
            if "## 1. 概述" in content or "## Introduction" in content or "## 概述" in content:
                structure_score += 0.5
                # 检查概述内容是否充实
                intro_match = re.search(r'##.*?概述.*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL | re.IGNORECASE)
                if intro_match and len(intro_match.group(1).strip()) < 100:
                    incomplete_sections.append("概述内容过于简短")
            else:
                missing_sections.append("概述/Introduction")
            
            # 检查用户故事
            if "## 2. 用户故事" in content or "用户故事" in content or "User Story" in content:
                structure_score += 0.5
            else:
                missing_sections.append("用户故事")
            
            # 检查功能需求
            if "## 3. 功能需求" in content or "功能需求" in content or "Functional Requirements" in content:
                structure_score += 0.5
            else:
                missing_sections.append("功能需求")
            
            # 检查非功能需求
            if "## 4. 非功能需求" in content or "非功能需求" in content or "Non-functional" in content:
                structure_score += 0.5
            else:
                missing_sections.append("非功能需求")
            
            criteria_scores['structure'] = structure_score
            score += structure_score
            
            # EARS 格式检查 (2分) - 更精确的模式匹配
            ears_patterns = len(re.findall(r'(?:WHEN|当|如果).*?(?:THEN|那么|则).*?(?:SHALL|应该|必须)', content, re.IGNORECASE | re.DOTALL))
            ears_score = min(ears_patterns * 0.15, 2.0)
            criteria_scores['ears_format'] = ears_score
            score += ears_score
            
            if ears_patterns < 5:
                issues.append(f"EARS 格式验收标准较少 (当前 {ears_patterns}，建议 5+)")
            elif ears_patterns < 10:
                issues.append(f"EARS 格式验收标准可以更多 (当前 {ears_patterns}，建议 10+)")
            
            # 用户故事质量 (2分) - 检查格式完整性
            user_story_patterns = len(re.findall(r'(?:作为|As a).*?(?:我希望|I want).*?(?:以便|So that)', content, re.IGNORECASE | re.DOTALL))
            user_story_score = min(user_story_patterns * 0.25, 2.0)
            criteria_scores['user_stories'] = user_story_score
            score += user_story_score
            
            if user_story_patterns < 3:
                issues.append(f"用户故事较少 (当前 {user_story_patterns}，建议 3+)")
            
            # 验收标准完整性 (2分) - 检查每个需求是否有验收标准
            acceptance_criteria = len(re.findall(r'(?:\*\*验收标准\*\*:|Acceptance Criteria)', content, re.IGNORECASE))
            requirements_count = len(re.findall(r'### \d+\.\d+', content))
            
            if requirements_count > 0:
                acceptance_ratio = acceptance_criteria / requirements_count
                acceptance_score = min(acceptance_ratio * 2.0, 2.0)
            else:
                acceptance_score = min(acceptance_criteria * 0.3, 2.0)
            
            criteria_scores['acceptance_criteria'] = acceptance_score
            score += acceptance_score
            
            if acceptance_criteria < requirements_count:
                issues.append(f"部分需求缺少验收标准 ({acceptance_criteria}/{requirements_count})")
            
            # 非功能需求覆盖 (1分) - 更全面的检查
            nfr_keywords = ['性能', '安全', '可用性', '可维护性', '兼容性', '可扩展性']
            nfr_coverage = sum(1 for keyword in nfr_keywords if keyword in content)
            nfr_score = min(nfr_coverage * 0.17, 1.0)
            criteria_scores['nfr_coverage'] = nfr_score
            score += nfr_score
            
            missing_nfr = [kw for kw in nfr_keywords if kw not in content]
            if missing_nfr:
                issues.append(f"缺少非功能需求: {', '.join(missing_nfr)}")
            
            # 约束条件 (1分)
            if "约束条件" in content or "限制" in content or "Constraints" in content:
                criteria_scores['constraints'] = 1.0
                score += 1.0
            else:
                criteria_scores['constraints'] = 0.0
                missing_sections.append("约束条件")
        else:
            # 英文评分标准 - 增强版
            # 基础结构检查 (2分) - 更严格的检查
            structure_score = 0.0
            
            # 检查 Introduction/Overview
            if "## Introduction" in content or "## Overview" in content:
                structure_score += 0.5
                # 检查内容是否充实
                intro_match = re.search(r'##.*?(?:Introduction|Overview).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL | re.IGNORECASE)
                if intro_match and len(intro_match.group(1).strip()) < 100:
                    incomplete_sections.append("Introduction/Overview content is too brief")
            else:
                missing_sections.append("Introduction/Overview")
            
            # 检查 Glossary
            if "## Glossary" in content or "## Terminology" in content:
                structure_score += 0.5
                # 检查是否有定义
                glossary_match = re.search(r'##.*?(?:Glossary|Terminology).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL | re.IGNORECASE)
                if glossary_match:
                    definitions = len(re.findall(r'^\s*-\s*\*\*.*?\*\*:', glossary_match.group(1), re.MULTILINE))
                    if definitions < 3:
                        incomplete_sections.append(f"Glossary has few definitions ({definitions}, suggest 3+)")
            else:
                missing_sections.append("Glossary")
            
            # 检查 Requirements
            if "## Requirements" in content or "## Functional Requirements" in content:
                structure_score += 0.5
            else:
                missing_sections.append("Requirements")
            
            # 检查 Non-functional Requirements
            if "Non-functional" in content or "Non-Functional" in content:
                structure_score += 0.5
            else:
                missing_sections.append("Non-functional Requirements")
            
            criteria_scores['structure'] = structure_score
            score += structure_score
            
            # EARS 格式检查 (2分) - 更精确的模式匹配
            ears_patterns = len(re.findall(r'(?:WHEN|IF|WHILE|WHERE).*?(?:THEN|THE\s+system\s+SHALL)', content, re.IGNORECASE | re.DOTALL))
            ears_score = min(ears_patterns * 0.12, 2.0)
            criteria_scores['ears_format'] = ears_score
            score += ears_score
            
            if ears_patterns < 5:
                issues.append(f"Few EARS-format acceptance criteria (current {ears_patterns}, target 5+)")
            elif ears_patterns < 10:
                issues.append(f"EARS-format criteria could be more (current {ears_patterns}, target 10+)")
            
            # 用户故事质量 (2分) - 检查格式完整性
            user_story_patterns = len(re.findall(r'(?:As a|As an).*?I want.*?(?:So that|so that)', content, re.IGNORECASE | re.DOTALL))
            user_story_score = min(user_story_patterns * 0.2, 2.0)
            criteria_scores['user_stories'] = user_story_score
            score += user_story_score
            
            if user_story_patterns < 3:
                issues.append(f"Few user stories (current {user_story_patterns}, target 3+)")
            
            # 验收标准完整性 (2分) - 检查每个需求是否有验收标准
            acceptance_criteria = len(re.findall(r'(?:Acceptance Criteria|#### Acceptance Criteria)', content, re.IGNORECASE))
            requirements_count = len(re.findall(r'### Requirement \d+', content, re.IGNORECASE))
            
            if requirements_count > 0:
                acceptance_ratio = acceptance_criteria / requirements_count
                acceptance_score = min(acceptance_ratio * 2.0, 2.0)
            else:
                acceptance_score = min(acceptance_criteria * 0.25, 2.0)
            
            criteria_scores['acceptance_criteria'] = acceptance_score
            score += acceptance_score
            
            if acceptance_criteria < requirements_count:
                issues.append(f"Some requirements lack acceptance criteria ({acceptance_criteria}/{requirements_count})")
            
            # 非功能需求覆盖 (1分) - 更全面的检查
            nfr_keywords = ['performance', 'security', 'usability', 'maintainability', 'compatibility', 'scalability', 'reliability']
            nfr_coverage = sum(1 for keyword in nfr_keywords if keyword.lower() in content.lower())
            nfr_score = min(nfr_coverage * 0.14, 1.0)
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
        """评估 Design 文档质量 (0-10) - 支持中英文，增强评分算法"""
        lang = language or self._detect_language(design_content)
        self.language = lang
        
        score = 0.0
        criteria_scores = {}
        missing_sections = []
        incomplete_sections = []
        issues = []
        
        if lang == 'zh':
            # 中文评分标准 - 增强版
            # 基础结构检查 (2.5分) - 更严格的检查
            structure_score = 0.0
            
            # 检查系统概述
            if "## 1. 系统概述" in design_content or "## 1. 概述" in design_content or "## Overview" in design_content:
                structure_score += 0.5
                # 检查内容充实度
                overview_match = re.search(r'##.*?概述.*?\n(.*?)(?=\n##|\Z)', design_content, re.DOTALL | re.IGNORECASE)
                if overview_match and len(overview_match.group(1).strip()) < 150:
                    incomplete_sections.append("系统概述内容过于简短")
            else:
                missing_sections.append("系统概述")
            
            # 检查架构设计
            if "## 2. 架构设计" in design_content or "## Architecture" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("架构设计")
            
            # 检查组件设计
            if "## 3. 组件设计" in design_content or "## Components" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("组件设计")
            
            # 检查数据流/接口设计
            if "## 4. 数据流设计" in design_content or "## 4. 接口设计" in design_content or "## Interface" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("数据流/接口设计")
            
            # 检查错误处理
            if "错误处理" in design_content or "异常处理" in design_content or "Error Handling" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("错误处理策略")
            
            criteria_scores['structure'] = structure_score
            score += structure_score
            
            # 需求追溯性检查 (2.5分) - 更精确的匹配
            req_references = len(re.findall(r'(?:需求|Requirements?|Validates:)\s*\d+\.\d+', design_content, re.IGNORECASE))
            # 检查双向追溯
            bidirectional_refs = len(re.findall(r'Validates:\s*Requirements?\s*\d+\.\d+', design_content, re.IGNORECASE))
            
            traceability_score = min(req_references * 0.15, 2.0)
            if bidirectional_refs > 0:
                traceability_score += min(bidirectional_refs * 0.1, 0.5)
            
            criteria_scores['traceability'] = traceability_score
            score += traceability_score
            
            if req_references < 3:
                issues.append(f"需求追溯较少 (当前 {req_references}，建议 5+)")
            if bidirectional_refs == 0:
                issues.append("缺少双向追溯 (Validates: Requirements X.Y)")
            
            # 架构图和设计图 (1.5分) - 检查图表质量
            mermaid_diagrams = len(re.findall(r'```mermaid', design_content))
            plantuml_diagrams = len(re.findall(r'```plantuml', design_content))
            diagram_keywords = len(re.findall(r'架构图|设计图|流程图|时序图', design_content))
            
            total_diagrams = mermaid_diagrams + plantuml_diagrams + diagram_keywords
            diagram_score = min(total_diagrams * 0.4, 1.5)
            criteria_scores['diagrams'] = diagram_score
            score += diagram_score
            
            if total_diagrams == 0:
                missing_sections.append("架构图/设计图")
            elif total_diagrams < 2:
                issues.append(f"设计图较少 (当前 {total_diagrams}，建议 2+)")
            
            # 组件详细度 (1.5分) - 检查组件描述完整性
            component_sections = len(re.findall(r'### \d+\.\d+', design_content))
            interface_definitions = len(re.findall(r'(?:接口定义|Interface|API|方法|Method)', design_content, re.IGNORECASE))
            responsibility_mentions = len(re.findall(r'(?:职责|Responsibility|负责)', design_content, re.IGNORECASE))
            
            component_score = 0.0
            if component_sections > 0:
                component_score += min(component_sections * 0.15, 0.5)
            if interface_definitions > 0:
                component_score += min(interface_definitions * 0.1, 0.5)
            if responsibility_mentions > 0:
                component_score += min(responsibility_mentions * 0.1, 0.5)
            
            criteria_scores['component_detail'] = component_score
            score += component_score
            
            if component_sections < 3:
                issues.append(f"组件数量较少 (当前 {component_sections}，建议 3+)")
            
            # 技术选型说明 (1分)
            tech_keywords = ['技术选型', '技术栈', '框架选择', '数据库', 'API', '协议']
            tech_coverage = sum(1 for keyword in tech_keywords if keyword in design_content)
            tech_score = min(tech_coverage * 0.2, 1.0)
            criteria_scores['technology'] = tech_score
            score += tech_score
            
            if tech_coverage < 2:
                issues.append("技术选型说明不足")
            
            # 非功能需求设计 (1分)
            nfr_design = ['性能设计', '安全设计', '可扩展性', '容错机制', '监控', '日志']
            nfr_coverage = sum(1 for keyword in nfr_design if keyword in design_content)
            nfr_score = min(nfr_coverage * 0.2, 1.0)
            criteria_scores['nfr_design'] = nfr_score
            score += nfr_score
            
            missing_nfr = [kw for kw in nfr_design if kw not in design_content]
            if len(missing_nfr) > 3:
                issues.append(f"缺少非功能需求设计: {', '.join(missing_nfr[:3])}")
            
            # 接口定义完整性 (1分)
            interface_indicators = len(re.findall(r'(?:接口定义|API\s*设计|数据结构|参数说明|返回值)', design_content))
            interface_score = min(interface_indicators * 0.25, 1.0)
            criteria_scores['interfaces'] = interface_score
            score += interface_score
        else:
            # 英文评分标准 - 增强版
            # 基础结构检查 (2.5分) - 更严格的检查
            structure_score = 0.0
            
            # 检查 Overview/Introduction
            if "## Overview" in design_content or "## Introduction" in design_content:
                structure_score += 0.5
                # 检查内容充实度
                overview_match = re.search(r'##.*?(?:Overview|Introduction).*?\n(.*?)(?=\n##|\Z)', design_content, re.DOTALL | re.IGNORECASE)
                if overview_match and len(overview_match.group(1).strip()) < 150:
                    incomplete_sections.append("Overview/Introduction content is too brief")
            else:
                missing_sections.append("Overview/Introduction")
            
            # 检查 Architecture
            if "## Architecture" in design_content or "## System Architecture" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("Architecture")
            
            # 检查 Components
            if "## Components" in design_content or "## Component" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("Components")
            
            # 检查 Interfaces/Data Flow
            if "## Interface" in design_content or "## Data Flow" in design_content or "## API" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("Interfaces/Data Flow")
            
            # 检查 Error Handling
            if "Error Handling" in design_content or "Exception Handling" in design_content:
                structure_score += 0.5
            else:
                missing_sections.append("Error Handling")
            
            criteria_scores['structure'] = structure_score
            score += structure_score
            
            # 需求追溯性检查 (2.5分) - 更精确的匹配
            req_references = len(re.findall(r'Requirement[s]?\s+\d+\.\d+|_Requirements:\s+\d+\.\d+|Validates:\s+Requirements?\s+\d+\.\d+', design_content, re.IGNORECASE))
            # 检查双向追溯
            bidirectional_refs = len(re.findall(r'Validates:\s*Requirements?\s+\d+\.\d+', design_content, re.IGNORECASE))
            
            traceability_score = min(req_references * 0.12, 2.0)
            if bidirectional_refs > 0:
                traceability_score += min(bidirectional_refs * 0.08, 0.5)
            
            criteria_scores['traceability'] = traceability_score
            score += traceability_score
            
            if req_references < 3:
                issues.append(f"Few requirements references (current {req_references}, target 5+)")
            if bidirectional_refs == 0:
                issues.append("Missing bidirectional traceability (Validates: Requirements X.Y)")
            
            # 架构图和设计图 (1.5分) - 检查图表质量
            mermaid_diagrams = len(re.findall(r'```mermaid', design_content))
            plantuml_diagrams = len(re.findall(r'```plantuml', design_content))
            diagram_keywords = len(re.findall(r'Architecture Diagram|Component Diagram|Sequence Diagram|Flow Diagram', design_content, re.IGNORECASE))
            
            total_diagrams = mermaid_diagrams + plantuml_diagrams + diagram_keywords
            diagram_score = min(total_diagrams * 0.35, 1.5)
            criteria_scores['diagrams'] = diagram_score
            score += diagram_score
            
            if total_diagrams == 0:
                missing_sections.append("Architecture/Design Diagrams")
            elif total_diagrams < 2:
                issues.append(f"Few diagrams (current {total_diagrams}, target 2+)")
            
            # 组件详细度 (1.5分) - 检查组件描述完整性
            component_sections = len(re.findall(r'### \d+\.', design_content))
            interface_definitions = len(re.findall(r'(?:Interface|API|Method|Function)\s*(?:Definition|Signature)', design_content, re.IGNORECASE))
            responsibility_mentions = len(re.findall(r'Responsibility|Responsibilities|Purpose', design_content, re.IGNORECASE))
            dependency_mentions = len(re.findall(r'Depend(?:s|encies)|Requires?', design_content, re.IGNORECASE))
            
            component_score = 0.0
            if component_sections > 0:
                component_score += min(component_sections * 0.12, 0.5)
            if interface_definitions > 0:
                component_score += min(interface_definitions * 0.08, 0.4)
            if responsibility_mentions > 0:
                component_score += min(responsibility_mentions * 0.08, 0.3)
            if dependency_mentions > 0:
                component_score += min(dependency_mentions * 0.06, 0.3)
            
            criteria_scores['component_detail'] = component_score
            score += component_score
            
            if component_sections < 3:
                issues.append(f"Few components (current {component_sections}, target 3+)")
            
            # 技术选型说明 (1分)
            tech_keywords = ['technology', 'framework', 'database', 'api', 'protocol', 'stack', 'library']
            tech_coverage = sum(1 for keyword in tech_keywords if keyword.lower() in design_content.lower())
            tech_score = min(tech_coverage * 0.15, 1.0)
            criteria_scores['technology'] = tech_score
            score += tech_score
            
            if tech_coverage < 2:
                issues.append("Insufficient technology stack explanation")
            
            # 非功能需求设计 (1分)
            nfr_design = ['performance', 'security', 'scalability', 'fault tolerance', 'monitoring', 'logging', 'error handling']
            nfr_coverage = sum(1 for keyword in nfr_design if keyword.lower() in design_content.lower())
            nfr_score = min(nfr_coverage * 0.15, 1.0)
            criteria_scores['nfr_design'] = nfr_score
            score += nfr_score
            
            missing_nfr = [kw for kw in nfr_design if kw.lower() not in design_content.lower()]
            if len(missing_nfr) > 4:
                issues.append(f"Missing non-functional design: {', '.join(missing_nfr[:3])}")
            
            # 接口定义完整性 (1分)
            interface_indicators = len(re.findall(r'(?:Interface|API\s+Design|Data\s+Model|Data\s+Structure|Parameter|Return\s+Value)', design_content, re.IGNORECASE))
            interface_score = min(interface_indicators * 0.2, 1.0)
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
