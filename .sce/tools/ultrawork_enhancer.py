#!/usr/bin/env python3
"""
Ultrawork Enhancer - 为 Kiro Spec 体系注入 Sisyphus 的不懈努力精神

核心理念: 像西西弗斯推石上山一样,永不放弃,不懈努力,直到任务完美完成
"""

import re
import os
from pathlib import Path
from typing import List, Dict, Tuple, Optional


class UltraworkEnhancer:
    """
    Ultrawork 增强器 - 在 Kiro Spec 体系中实现 Sisyphus 的不懈努力精神
    
    不是替代现有工具,而是增强执行质量和完成度
    """
    
    def __init__(self):
        self.quality_threshold = 9.0  # 专业级质量标准 (0-10)
        self.max_iterations = 10      # 防止无限循环
        self.improvement_log = []     # 记录改进过程
    
    # ==================== Requirements 阶段 Ultrawork ====================
    
    def enhance_requirements_quality(self, requirements_path: str) -> Dict:
        """
        Requirements 阶段的 Ultrawork 增强
        
        像资深产品经理一样深入思考每个用户场景
        """
        print("🔥 启动 Requirements 阶段 Ultrawork 增强...")
        
        if not os.path.exists(requirements_path):
            return {"error": "Requirements 文件不存在"}
        
        with open(requirements_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 评估当前质量
        quality_score = self._assess_requirements_quality(content)
        print(f"📊 Requirements 质量评分: {quality_score}/10")
        
        if quality_score >= self.quality_threshold:
            print("✅ Requirements 已达到专业级标准! Ultrawork 精神得到体现!")
            return {
                "success": True,
                "iterations": 0,
                "final_quality_score": quality_score,
                "message": "文档质量已达到专业级标准,无需进一步改进"
            }
        
        iteration = 0
        original_content = content
        
        while iteration < self.max_iterations:
            # 识别改进点
            improvements = self._identify_requirements_improvements(content)
            
            if not improvements:
                print("⚠️ 无法识别更多改进点,停止迭代")
                break
            
            # 应用改进 (Ultrawork 精神: 不懈努力)
            content = self._apply_requirements_improvements(content, improvements)
            iteration += 1
            
            # 重新评估质量
            new_quality_score = self._assess_requirements_quality(content)
            
            # 记录改进过程
            self.improvement_log.append({
                "stage": "requirements",
                "iteration": iteration,
                "improvements": improvements,
                "quality_score": new_quality_score
            })
            
            print(f"🔄 第 {iteration} 轮改进: {', '.join(improvements)}")
            print(f"📊 改进后质量评分: {new_quality_score}/10")
            
            # 检查是否达到质量标准
            if new_quality_score >= self.quality_threshold:
                print("✅ Requirements 已达到专业级标准!")
                break
            
            # 检查是否有实际改进
            if new_quality_score <= quality_score:
                print("⚠️ 质量评分未提升,停止迭代")
                break
            
            quality_score = new_quality_score
        
        # 如果有改进,更新文件
        if content != original_content:
            with open(requirements_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"📝 Requirements 已更新,共进行 {iteration} 轮 Ultrawork 改进")
        
        return {
            "success": True,
            "iterations": iteration,
            "final_quality_score": self._assess_requirements_quality(content),
            "improvements_applied": self.improvement_log
        }
    
    def _assess_requirements_quality(self, content: str) -> float:
        """评估 Requirements 文档质量 (0-10)"""
        score = 0.0
        
        # 基础结构检查 (2分)
        if "## 1. 概述" in content: score += 0.5
        if "## 2. 用户故事" in content: score += 0.5
        if "## 3. 功能需求" in content: score += 0.5
        if "## 4. 非功能需求" in content: score += 0.5
        
        # EARS 格式检查 (2分)
        ears_patterns = len(re.findall(r'WHEN.*THEN', content))
        score += min(ears_patterns * 0.2, 2.0)
        
        # 用户故事质量 (2分)
        user_story_patterns = len(re.findall(r'作为.*我希望.*以便', content))
        score += min(user_story_patterns * 0.3, 2.0)
        
        # 验收标准完整性 (2分)
        acceptance_criteria = len(re.findall(r'\*\*验收标准\*\*:', content))
        score += min(acceptance_criteria * 0.4, 2.0)
        
        # 非功能需求覆盖 (1分)
        nfr_keywords = ['性能', '安全', '可用性', '可维护性', '兼容性']
        nfr_coverage = sum(1 for keyword in nfr_keywords if keyword in content)
        score += min(nfr_coverage * 0.2, 1.0)
        
        # 约束条件 (1分)
        if "约束条件" in content or "限制" in content:
            score += 1.0
        
        return min(score, 10.0)
    
    def _identify_requirements_improvements(self, content: str) -> List[str]:
        """识别 Requirements 文档的改进点"""
        improvements = []
        
        # 检查是否缺少关键章节
        if "## 1. 概述" not in content:
            improvements.append("添加项目概述章节")
        
        if "## 2. 用户故事" not in content:
            improvements.append("添加用户故事章节")
        
        if "## 4. 非功能需求" not in content:
            improvements.append("添加非功能需求章节")
        
        # 检查 EARS 格式
        if len(re.findall(r'WHEN.*THEN', content)) < 3:
            improvements.append("增加更多 EARS 格式的验收标准")
        
        # 检查用户故事格式
        if len(re.findall(r'作为.*我希望.*以便', content)) < 2:
            improvements.append("完善用户故事格式")
        
        # 检查非功能需求覆盖 - 修复逻辑错误
        nfr_keywords = ['性能需求', '安全需求', '可用性需求', '可维护性需求']
        missing_nfr = []
        for kw in nfr_keywords:
            if kw not in content:
                missing_nfr.append(kw.replace('需求', ''))
        
        if missing_nfr and "## 4. 非功能需求" in content:
            improvements.append(f"补充非功能需求: {', '.join(missing_nfr)}")
        
        return improvements
    
    def _apply_requirements_improvements(self, content: str, improvements: List[str]) -> str:
        """应用 Requirements 改进 (这里是示例,实际需要更复杂的逻辑)"""
        # 这里只是示例实现,实际应该根据具体改进点进行相应修改
        improved_content = content
        
        for improvement in improvements:
            if "添加非功能需求章节" in improvement:
                if "## 4. 非功能需求" not in improved_content:
                    improved_content += "\n\n## 4. 非功能需求\n\n### 4.1 性能需求\n- 系统响应时间应小于 2 秒\n\n### 4.2 安全需求\n- 用户数据必须加密存储\n\n### 4.3 可用性需求\n- 系统可用性应达到 99.9%\n"
        
        return improved_content
    
    # ==================== Design 阶段 Ultrawork ====================
    
    def enhance_design_completeness(self, design_path: str, requirements_path: str) -> Dict:
        """
        Design 阶段的 Ultrawork 增强
        
        像资深架构师一样设计每个组件
        """
        print("🔥 启动 Design 阶段 Ultrawork 增强...")
        
        if not os.path.exists(design_path):
            return {"error": "Design 文件不存在"}
        
        if not os.path.exists(requirements_path):
            return {"error": "Requirements 文件不存在,无法进行双向追溯"}
        
        with open(design_path, 'r', encoding='utf-8') as f:
            design_content = f.read()
        
        with open(requirements_path, 'r', encoding='utf-8') as f:
            requirements_content = f.read()
        
        iteration = 0
        original_content = design_content
        
        while iteration < self.max_iterations:
            # 评估当前质量
            quality_score = self._assess_design_quality(design_content, requirements_content)
            print(f"📊 Design 质量评分: {quality_score}/10")
            
            if quality_score >= self.quality_threshold:
                print("✅ Design 已达到专业级标准!")
                break
            
            # 识别改进点
            improvements = self._identify_design_improvements(design_content, requirements_content)
            
            if not improvements:
                print("⚠️ 无法识别更多改进点,停止迭代")
                break
            
            # 应用改进 (Ultrawork 精神: 不懈努力)
            design_content = self._apply_design_improvements(design_content, improvements)
            iteration += 1
            
            # 记录改进过程
            self.improvement_log.append({
                "stage": "design",
                "iteration": iteration,
                "improvements": improvements,
                "quality_score": quality_score
            })
            
            print(f"🔄 第 {iteration} 轮改进: {', '.join(improvements)}")
        
        # 如果有改进,更新文件
        if design_content != original_content:
            with open(design_path, 'w', encoding='utf-8') as f:
                f.write(design_content)
            print(f"📝 Design 已更新,共进行 {iteration} 轮 Ultrawork 改进")
        
        return {
            "success": True,
            "iterations": iteration,
            "final_quality_score": self._assess_design_quality(design_content, requirements_content),
            "improvements_applied": self.improvement_log
        }
    
    def _assess_design_quality(self, design_content: str, requirements_content: str) -> float:
        """评估 Design 文档质量 (0-10)"""
        score = 0.0
        
        # 基础结构检查 (2分)
        if "## 1. 系统概述" in design_content or "## 1. 概述" in design_content: score += 0.5
        if "## 2. 架构设计" in design_content: score += 0.5
        if "## 3. 组件设计" in design_content: score += 0.5
        if "## 4. 数据流设计" in design_content or "## 4. 接口设计" in design_content: score += 0.5
        
        # 需求追溯性检查 (2分)
        # 检查是否有明确的需求到设计的映射
        req_references = len(re.findall(r'需求\s*\d+\.\d+|Requirements?\s*\d+\.\d+', design_content))
        score += min(req_references * 0.3, 2.0)
        
        # 架构图和设计图 (1.5分)
        diagram_indicators = len(re.findall(r'```mermaid|```plantuml|架构图|设计图|流程图', design_content))
        score += min(diagram_indicators * 0.5, 1.5)
        
        # 技术选型说明 (1.5分)
        tech_keywords = ['技术选型', '技术栈', '框架选择', '数据库', 'API', '协议']
        tech_coverage = sum(1 for keyword in tech_keywords if keyword in design_content)
        score += min(tech_coverage * 0.25, 1.5)
        
        # 非功能需求设计 (1.5分)
        nfr_design = ['性能设计', '安全设计', '可扩展性', '容错机制', '监控']
        nfr_coverage = sum(1 for keyword in nfr_design if keyword in design_content)
        score += min(nfr_coverage * 0.3, 1.5)
        
        # 接口定义完整性 (1.5分)
        interface_indicators = len(re.findall(r'接口定义|API\s*设计|数据结构|参数说明', design_content))
        score += min(interface_indicators * 0.4, 1.5)
        
        return min(score, 10.0)
    
    def _identify_design_improvements(self, design_content: str, requirements_content: str) -> List[str]:
        """识别 Design 文档的改进点"""
        improvements = []
        
        # 检查基础结构
        if "## 1. 系统概述" not in design_content and "## 1. 概述" not in design_content:
            improvements.append("添加系统概述章节")
        
        if "## 2. 架构设计" not in design_content:
            improvements.append("添加架构设计章节")
        
        if "## 3. 组件设计" not in design_content:
            improvements.append("添加组件设计章节")
        
        # 检查需求追溯
        req_references = len(re.findall(r'需求\s*\d+\.\d+|Requirements?\s*\d+\.\d+', design_content))
        if req_references < 3:
            improvements.append("增加需求到设计的双向追溯")
        
        # 检查架构图
        if "```mermaid" not in design_content and "架构图" not in design_content:
            improvements.append("添加架构图或设计图")
        
        # 检查技术选型
        tech_keywords = ['技术选型', '技术栈', '框架选择']
        if not any(keyword in design_content for keyword in tech_keywords):
            improvements.append("补充技术选型说明")
        
        # 检查非功能需求设计
        nfr_design = ['性能设计', '安全设计', '可扩展性']
        missing_nfr = [nfr for nfr in nfr_design if nfr not in design_content]
        if missing_nfr:
            improvements.append(f"补充非功能需求设计: {', '.join(missing_nfr)}")
        
        return improvements
    
    def _apply_design_improvements(self, content: str, improvements: List[str]) -> str:
        """应用 Design 改进"""
        improved_content = content
        
        for improvement in improvements:
            if "添加架构图或设计图" in improvement:
                if "```mermaid" not in improved_content:
                    improved_content += "\n\n### 系统架构图\n\n```mermaid\ngraph TB\n    A[用户界面] --> B[业务逻辑层]\n    B --> C[数据访问层]\n    C --> D[数据存储]\n```\n"
            
            if "补充技术选型说明" in improvement:
                if "技术选型" not in improved_content:
                    improved_content += "\n\n## 技术选型\n\n### 核心技术栈\n- 前端: React/Vue.js\n- 后端: Node.js/Python\n- 数据库: PostgreSQL/MongoDB\n- 缓存: Redis\n\n### 选型理由\n- 考虑团队技术栈熟悉度\n- 满足性能和扩展性要求\n- 社区支持和生态完善\n"
        
        return improved_content
    
    # ==================== Tasks 阶段 Ultrawork ====================
    
    def enhance_task_execution(self, tasks_path: str) -> Dict:
        """
        Tasks 阶段的 Ultrawork 增强
        
        像资深开发者一样实现每行代码,遇到困难不放弃
        """
        print("🔥 启动 Tasks 阶段 Ultrawork 增强...")
        
        if not os.path.exists(tasks_path):
            return {"error": "Tasks 文件不存在"}
        
        with open(tasks_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 分析任务完成情况
        task_analysis = self._analyze_task_completion(content)
        
        if task_analysis['incomplete_count'] == 0:
            return {
                "success": True,
                "message": "✅ 所有任务已完成! Ultrawork 精神得到完美体现!",
                "task_analysis": task_analysis
            }
        
        print(f"📋 任务完成情况分析:")
        print(f"  - 总任务数: {task_analysis['total_count']}")
        print(f"  - 已完成: {task_analysis['completed_count']}")
        print(f"  - 进行中: {task_analysis['in_progress_count']}")
        print(f"  - 未开始: {task_analysis['not_started_count']}")
        print(f"  - 完成率: {task_analysis['completion_rate']:.1f}%")
        
        # Ultrawork 精神: 不懈努力提醒
        ultrawork_messages = self._generate_ultrawork_reminders(task_analysis)
        
        for message in ultrawork_messages:
            print(f"🔥 {message}")
        
        # 识别阻塞任务和优先级
        priority_tasks = self._identify_priority_tasks(task_analysis['incomplete_tasks'])
        
        return {
            "success": True,
            "message": f"发现 {task_analysis['incomplete_count']} 个未完成任务,需要继续推进",
            "task_analysis": task_analysis,
            "priority_tasks": priority_tasks,
            "ultrawork_reminders": ultrawork_messages,
            "next_actions": self._suggest_next_actions(task_analysis)
        }
    
    def _analyze_task_completion(self, content: str) -> Dict:
        """分析任务完成情况"""
        # 匹配不同状态的任务
        completed_tasks = re.findall(r'- \[x\] (.+)', content)
        in_progress_tasks = re.findall(r'- \[-\] (.+)', content)
        not_started_tasks = re.findall(r'- \[ \] (.+)', content)
        queued_tasks = re.findall(r'- \[~\] (.+)', content)
        
        total_count = len(completed_tasks) + len(in_progress_tasks) + len(not_started_tasks) + len(queued_tasks)
        completed_count = len(completed_tasks)
        incomplete_count = len(in_progress_tasks) + len(not_started_tasks) + len(queued_tasks)
        
        completion_rate = (completed_count / total_count * 100) if total_count > 0 else 0
        
        return {
            "total_count": total_count,
            "completed_count": completed_count,
            "completed_tasks": completed_tasks,
            "in_progress_count": len(in_progress_tasks),
            "in_progress_tasks": in_progress_tasks,
            "not_started_count": len(not_started_tasks),
            "not_started_tasks": not_started_tasks,
            "queued_count": len(queued_tasks),
            "queued_tasks": queued_tasks,
            "incomplete_count": incomplete_count,
            "incomplete_tasks": in_progress_tasks + not_started_tasks + queued_tasks,
            "completion_rate": completion_rate
        }
    
    def _generate_ultrawork_reminders(self, task_analysis: Dict) -> List[str]:
        """生成 Ultrawork 精神提醒"""
        reminders = []
        
        completion_rate = task_analysis['completion_rate']
        
        if completion_rate == 0:
            reminders.append("Sisyphus 精神: 万事开头难,但永不放弃! 开始推动第一块石头!")
        elif completion_rate < 30:
            reminders.append("Sisyphus 精神: 石头刚开始滚动,保持动力,持续推进!")
        elif completion_rate < 70:
            reminders.append("Sisyphus 精神: 已经爬到半山腰,不能松懈,继续向山顶冲刺!")
        elif completion_rate < 95:
            reminders.append("Sisyphus 精神: 接近山顶了,最后的冲刺最关键,不懈努力!")
        else:
            reminders.append("Sisyphus 精神: 即将登顶,每个细节都要完美,追求卓越!")
        
        if task_analysis['in_progress_count'] > 0:
            reminders.append(f"有 {task_analysis['in_progress_count']} 个任务正在进行中,保持专注,逐个击破!")
        
        if task_analysis['not_started_count'] > 3:
            reminders.append("任务较多,但不要被数量吓倒,分解执行,每完成一个都是胜利!")
        
        return reminders
    
    def _identify_priority_tasks(self, incomplete_tasks: List[str]) -> List[Dict]:
        """识别优先级任务"""
        priority_tasks = []
        
        for i, task in enumerate(incomplete_tasks):
            priority = "normal"
            reasons = []
            
            # 基于关键词判断优先级
            high_priority_keywords = ['基础', '核心', '关键', '重要', '阻塞', '依赖']
            urgent_keywords = ['紧急', '立即', '马上', '优先']
            
            task_lower = task.lower()
            
            if any(keyword in task for keyword in high_priority_keywords):
                priority = "high"
                reasons.append("包含关键词")
            
            if any(keyword in task for keyword in urgent_keywords):
                priority = "urgent"
                reasons.append("标记为紧急")
            
            # 基于任务编号判断(假设编号小的更基础)
            if re.match(r'^\d+\.\d+', task) and task.startswith(('1.', '2.')):
                if priority == "normal":
                    priority = "high"
                reasons.append("基础任务")
            
            priority_tasks.append({
                "task": task,
                "priority": priority,
                "reasons": reasons,
                "index": i
            })
        
        # 按优先级排序
        priority_order = {"urgent": 0, "high": 1, "normal": 2}
        priority_tasks.sort(key=lambda x: priority_order[x["priority"]])
        
        return priority_tasks
    
    def _suggest_next_actions(self, task_analysis: Dict) -> List[str]:
        """建议下一步行动"""
        suggestions = []
        
        if task_analysis['in_progress_count'] > 0:
            suggestions.append("优先完成进行中的任务,避免任务切换成本")
        
        if task_analysis['not_started_count'] > 0:
            suggestions.append("从最基础或最重要的未开始任务开始")
        
        if task_analysis['completion_rate'] < 50:
            suggestions.append("建议专注于单个任务,避免并行过多任务")
        else:
            suggestions.append("可以考虑并行处理独立的任务以提高效率")
        
        suggestions.append("每完成一个任务立即更新状态,保持进度可见性")
        suggestions.append("遇到困难时体现 Ultrawork 精神: 不放弃,寻找替代方案")
        
        return suggestions
    
    # ==================== 通用工具方法 ====================
    
    def get_improvement_log(self) -> List[Dict]:
        """获取改进日志"""
        return self.improvement_log
    
    def reset_log(self):
        """重置改进日志"""
        self.improvement_log = []
    
    def set_quality_threshold(self, threshold: float):
        """设置质量阈值"""
        self.quality_threshold = max(0.0, min(10.0, threshold))


def main():
    """命令行工具入口"""
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python ultrawork_enhancer.py <command> [args]")
        print("命令:")
        print("  requirements <path>  - 增强 Requirements 文档质量")
        print("  design <design_path> <requirements_path>  - 增强 Design 文档完整性")
        print("  tasks <path>  - 检查 Tasks 完成情况")
        return
    
    enhancer = UltraworkEnhancer()
    command = sys.argv[1]
    
    if command == "requirements" and len(sys.argv) >= 3:
        result = enhancer.enhance_requirements_quality(sys.argv[2])
        print(f"结果: {result}")
    
    elif command == "design" and len(sys.argv) >= 4:
        result = enhancer.enhance_design_completeness(sys.argv[2], sys.argv[3])
        print(f"结果: {result}")
    
    elif command == "tasks" and len(sys.argv) >= 3:
        result = enhancer.enhance_task_execution(sys.argv[2])
        print(f"结果: {result}")
    
    else:
        print("❌ 无效的命令或参数")


if __name__ == "__main__":
    main()