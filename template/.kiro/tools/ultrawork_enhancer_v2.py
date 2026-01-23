#!/usr/bin/env python3
"""
Ultrawork Enhancer V2 - 模块化重构版本

核心理念: 像西西弗斯推石上山一样,永不放弃,不懈努力,直到任务完美完成

重构目标:
- 提取评估、识别、应用逻辑到独立的类
- 创建基础接口
- 保持现有功能不变
"""

import os
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, field

# 导入模块化组件
from document_evaluator import DocumentEvaluator, QualityAssessment
from improvement_identifier import ImprovementIdentifier, Improvement
from modification_applicator import ModificationApplicator, ModificationResult


@dataclass
class EnhancementResult:
    """增强结果"""
    success: bool
    document_type: str  # 'requirements', 'design', 'tasks'
    initial_score: float
    final_score: float
    iterations: int
    improvements_applied: List[Improvement] = field(default_factory=list)
    improvements_failed: List = field(default_factory=list)
    stopping_reason: str = ""
    modification_report: str = ""
    message: str = ""


class UltraworkEnhancer:
    """
    Ultrawork 增强器 V2 - 模块化架构
    
    使用独立的评估器、识别器和应用器组件
    """
    
    def __init__(self):
        self.quality_threshold = 9.0  # 专业级质量标准 (0-10)
        self.max_iterations = 10      # 防止无限循环
        self.improvement_log = []     # 记录改进过程
        
        # 初始化模块化组件
        self.evaluator = DocumentEvaluator()
        self.identifier = ImprovementIdentifier()
        self.applicator = ModificationApplicator()

    def enhance_requirements_quality(self, requirements_path: str) -> Dict:
        """
        Requirements 阶段的 Ultrawork 增强
        
        像资深产品经理一样深入思考每个用户场景
        """
        print("🔥 启动 Requirements 阶段 Ultrawork 增强...")
        
        if not os.path.exists(requirements_path):
            return {"error": "Requirements 文件不存在", "success": False}
        
        with open(requirements_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 使用 DocumentEvaluator 评估质量
        assessment = self.evaluator.assess_requirements_quality(content)
        language = assessment.language
        
        print(f"📝 检测到文档语言: {'中文' if language == 'zh' else 'English'}")
        print(f"📊 Requirements 质量评分: {assessment.score}/10")
        
        if assessment.score >= self.quality_threshold:
            print("✅ Requirements 已达到专业级标准! Ultrawork 精神得到体现!")
            return {
                "success": True,
                "iterations": 0,
                "final_quality_score": assessment.score,
                "message": "文档质量已达到专业级标准,无需进一步改进"
            }
        
        iteration = 0
        original_content = content
        quality_score = assessment.score
        
        while iteration < self.max_iterations:
            # 使用 ImprovementIdentifier 识别改进点
            improvements = self.identifier.identify_requirements_improvements(content, assessment)
            
            if not improvements:
                print("⚠️ 无法识别更多改进点,停止迭代")
                stopping_reason = "no_improvements"
                break
            
            # 使用 ModificationApplicator 应用改进
            result = self.applicator.apply_requirements_improvements(content, improvements, language)
            content = result.modified_content
            iteration += 1
            
            # 重新评估质量
            assessment = self.evaluator.assess_requirements_quality(content)
            new_quality_score = assessment.score
            
            # 记录改进过程
            self.improvement_log.append({
                "stage": "requirements",
                "iteration": iteration,
                "improvements": [imp.description for imp in result.applied_improvements],
                "quality_score": new_quality_score
            })
            
            print(f"🔄 第 {iteration} 轮改进: {', '.join([imp.description for imp in result.applied_improvements])}")
            print(f"📊 改进后质量评分: {new_quality_score}/10")
            
            # 检查是否达到质量标准
            if new_quality_score >= self.quality_threshold:
                print("✅ Requirements 已达到专业级标准!")
                stopping_reason = "threshold_reached"
                break
            
            # 检查是否有实际改进
            if new_quality_score <= quality_score:
                print("⚠️ 质量评分未提升,停止迭代")
                stopping_reason = "plateau"
                break
            
            quality_score = new_quality_score
        else:
            stopping_reason = "max_iterations"
        
        # 如果有改进,更新文件
        if content != original_content:
            with open(requirements_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"📝 Requirements 已更新,共进行 {iteration} 轮 Ultrawork 改进")
        
        final_assessment = self.evaluator.assess_requirements_quality(content)
        
        return {
            "success": True,
            "iterations": iteration,
            "initial_quality_score": quality_score,
            "final_quality_score": final_assessment.score,
            "stopping_reason": stopping_reason,
            "improvements_applied": self.improvement_log
        }

    def enhance_design_completeness(self, design_path: str, requirements_path: str) -> Dict:
        """
        Design 阶段的 Ultrawork 增强
        
        像资深架构师一样设计每个组件
        """
        print("🔥 启动 Design 阶段 Ultrawork 增强...")
        
        if not os.path.exists(design_path):
            return {"error": "Design 文件不存在", "success": False}
        
        if not os.path.exists(requirements_path):
            return {"error": "Requirements 文件不存在,无法进行双向追溯", "success": False}
        
        with open(design_path, 'r', encoding='utf-8') as f:
            design_content = f.read()
        
        with open(requirements_path, 'r', encoding='utf-8') as f:
            requirements_content = f.read()
        
        # 使用 DocumentEvaluator 评估质量
        assessment = self.evaluator.assess_design_quality(design_content, requirements_content)
        language = assessment.language
        
        print(f"📝 检测到文档语言: {'中文' if language == 'zh' else 'English'}")
        print(f"📊 Design 质量评分: {assessment.score}/10")
        
        iteration = 0
        original_content = design_content
        quality_score = assessment.score
        
        while iteration < self.max_iterations:
            if quality_score >= self.quality_threshold:
                print("✅ Design 已达到专业级标准!")
                stopping_reason = "threshold_reached"
                break
            
            # 使用 ImprovementIdentifier 识别改进点
            improvements = self.identifier.identify_design_improvements(design_content, requirements_content, assessment)
            
            if not improvements:
                print("⚠️ 无法识别更多改进点,停止迭代")
                stopping_reason = "no_improvements"
                break
            
            # 使用 ModificationApplicator 应用改进
            result = self.applicator.apply_design_improvements(design_content, improvements, requirements_content, language)
            design_content = result.modified_content
            iteration += 1
            
            # 重新评估质量
            assessment = self.evaluator.assess_design_quality(design_content, requirements_content)
            new_quality_score = assessment.score
            
            # 记录改进过程
            self.improvement_log.append({
                "stage": "design",
                "iteration": iteration,
                "improvements": [imp.description for imp in result.applied_improvements],
                "quality_score": new_quality_score
            })
            
            print(f"🔄 第 {iteration} 轮改进: {', '.join([imp.description for imp in result.applied_improvements])}")
            print(f"📊 改进后质量评分: {new_quality_score}/10")
            
            # 检查是否有实际改进
            if new_quality_score <= quality_score:
                print("⚠️ 质量评分未提升,停止迭代")
                stopping_reason = "plateau"
                break
            
            quality_score = new_quality_score
        else:
            stopping_reason = "max_iterations"
        
        # 如果有改进,更新文件
        if design_content != original_content:
            with open(design_path, 'w', encoding='utf-8') as f:
                f.write(design_content)
            print(f"📝 Design 已更新,共进行 {iteration} 轮 Ultrawork 改进")
        
        final_assessment = self.evaluator.assess_design_quality(design_content, requirements_content)
        
        return {
            "success": True,
            "iterations": iteration,
            "initial_quality_score": quality_score,
            "final_quality_score": final_assessment.score,
            "stopping_reason": stopping_reason,
            "improvements_applied": self.improvement_log
        }
    
    def enhance_task_execution(self, tasks_path: str) -> Dict:
        """
        Tasks 阶段的 Ultrawork 增强
        
        像资深开发者一样实现每行代码,遇到困难不放弃
        """
        print("🔥 启动 Tasks 阶段 Ultrawork 增强...")
        
        if not os.path.exists(tasks_path):
            return {"error": "Tasks 文件不存在", "success": False}
        
        with open(tasks_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 使用 DocumentEvaluator 评估任务完成情况
        assessment = self.evaluator.assess_tasks_quality(content)
        
        # 分析任务完成情况 (保持原有逻辑)
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
    
    # 保持原有的辅助方法
    def _analyze_task_completion(self, content: str) -> Dict:
        """分析任务完成情况"""
        import re
        
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
        import re
        
        priority_tasks = []
        
        for i, task in enumerate(incomplete_tasks):
            priority = "normal"
            reasons = []
            
            # 基于关键词判断优先级
            high_priority_keywords = ['基础', '核心', '关键', '重要', '阻塞', '依赖']
            urgent_keywords = ['紧急', '立即', '马上', '优先']
            
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
    
    # 通用工具方法
    def get_improvement_log(self) -> List[Dict]:
        """获取改进日志"""
        return self.improvement_log
    
    def reset_log(self):
        """重置改进日志"""
        self.improvement_log = []
    
    def set_quality_threshold(self, threshold: float):
        """设置质量阈值"""
        self.quality_threshold = max(0.0, min(10.0, threshold))
    
    def set_max_iterations(self, max_iter: int):
        """设置最大迭代次数"""
        self.max_iterations = max(1, min(100, max_iter))


def main():
    """命令行工具入口"""
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python ultrawork_enhancer_v2.py <command> [args]")
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
