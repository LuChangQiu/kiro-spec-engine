#!/usr/bin/env python3
"""
Ultrawork Enhancer V3 - 主控制器（带收敛控制）

负责协调文档增强过程，管理改进循环，强制收敛条件
"""

import os
from typing import Optional, List, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from document_evaluator import DocumentEvaluator, QualityAssessment
from improvement_identifier import ImprovementIdentifier, Improvement
from modification_applicator import ModificationApplicator, ModificationResult
from quality_scorer import QualityScorer, ScoringResult


@dataclass
class EnhancementResult:
    """增强结果"""
    success: bool
    document_type: str  # 'requirements', 'design', 'tasks'
    initial_score: float
    final_score: float
    iterations: int
    improvements_applied: List[Improvement] = field(default_factory=list)
    improvements_failed: List[Tuple[Improvement, Exception]] = field(default_factory=list)
    stopping_reason: str = ""  # 'threshold_reached', 'max_iterations', 'plateau', 'no_improvements'
    modification_report: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    score_history: List[float] = field(default_factory=list)


class UltraworkEnhancerV3:
    """
    Ultrawork 增强器 V3 - 主控制器
    
    集成所有核心组件，管理改进循环，强制收敛条件
    """
    
    def __init__(self, 
                 quality_threshold: float = 9.0,
                 max_iterations: int = 10,
                 plateau_iterations: int = 3,
                 min_score_improvement: float = 0.1):
        """
        初始化增强器
        
        Args:
            quality_threshold: 质量阈值 (0-10)
            max_iterations: 最大迭代次数
            plateau_iterations: 平台期迭代次数（连续N次无改进则停止）
            min_score_improvement: 最小分数改进（低于此值视为无改进）
        """
        self.quality_threshold = quality_threshold
        self.max_iterations = max_iterations
        self.plateau_iterations = plateau_iterations
        self.min_score_improvement = min_score_improvement
        
        # 初始化核心组件
        self.evaluator = DocumentEvaluator()
        self.identifier = ImprovementIdentifier()
        self.applicator = ModificationApplicator()
        self.scorer = QualityScorer()
    
    def set_quality_threshold(self, threshold: float):
        """设置质量阈值"""
        if not 0.0 <= threshold <= 10.0:
            raise ValueError(f"Threshold must be between 0.0 and 10.0, got {threshold}")
        self.quality_threshold = threshold
    
    def set_max_iterations(self, max_iter: int):
        """设置最大迭代次数"""
        if not 1 <= max_iter <= 100:
            raise ValueError(f"Max iterations must be between 1 and 100, got {max_iter}")
        self.max_iterations = max_iter
    
    def enhance_requirements_quality(self, requirements_path: str) -> EnhancementResult:
        """
        增强 Requirements 文档质量
        
        Args:
            requirements_path: Requirements 文档路径
        
        Returns:
            EnhancementResult: 增强结果
        """
        print(f"\n{'='*60}")
        print(f"Enhancing Requirements: {requirements_path}")
        print(f"{'='*60}\n")
        
        # 读取文档
        try:
            with open(requirements_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            return EnhancementResult(
                success=False,
                document_type='requirements',
                initial_score=0.0,
                final_score=0.0,
                iterations=0,
                stopping_reason=f"file_read_error: {e}"
            )
        
        # 初始评估
        initial_assessment = self.evaluator.assess_requirements_quality(content)
        initial_score = initial_assessment.score
        
        print(f"Initial Score: {initial_score:.2f}/10")
        print(f"Language: {initial_assessment.language}")
        print(f"Missing Sections: {initial_assessment.missing_sections}")
        print(f"Issues: {len(initial_assessment.issues)}\n")
        
        # 检查是否已达到阈值
        if initial_score >= self.quality_threshold:
            print(f"✓ Already meets quality threshold ({self.quality_threshold})")
            return EnhancementResult(
                success=True,
                document_type='requirements',
                initial_score=initial_score,
                final_score=initial_score,
                iterations=0,
                stopping_reason='threshold_reached',
                score_history=[initial_score]
            )
        
        # 开始改进循环
        current_content = content
        current_score = initial_score
        score_history = [initial_score]
        all_applied = []
        all_failed = []
        iteration = 0
        plateau_count = 0
        
        while iteration < self.max_iterations:
            iteration += 1
            print(f"\n--- Iteration {iteration}/{self.max_iterations} ---")
            
            # 评估当前质量
            assessment = self.evaluator.assess_requirements_quality(current_content)
            
            # 识别改进
            improvements = self.identifier.identify_requirements_improvements(
                current_content, 
                assessment
            )
            
            if not improvements:
                print("✓ No more improvements identified")
                stopping_reason = 'no_improvements'
                break
            
            print(f"Identified {len(improvements)} improvements")
            
            # 应用改进
            result = self.applicator.apply_requirements_improvements(
                current_content,
                improvements,
                language=assessment.language
            )
            
            print(f"Applied {len(result.applied_improvements)} improvements")
            print(f"Failed {len(result.failed_improvements)} improvements")
            
            # 更新内容
            current_content = result.modified_content
            all_applied.extend(result.applied_improvements)
            all_failed.extend(result.failed_improvements)
            
            # 重新评估
            new_assessment = self.evaluator.assess_requirements_quality(current_content)
            new_score = new_assessment.score
            score_history.append(new_score)
            
            score_delta = new_score - current_score
            print(f"Score: {current_score:.2f} → {new_score:.2f} (Δ{score_delta:+.2f})")
            
            # 检查收敛条件
            
            # 1. 达到阈值
            if new_score >= self.quality_threshold:
                print(f"\n✓ Quality threshold reached ({self.quality_threshold})")
                stopping_reason = 'threshold_reached'
                current_score = new_score
                break
            
            # 2. 分数无改进（平台期）
            if score_delta < self.min_score_improvement:
                plateau_count += 1
                print(f"⚠ Plateau detected ({plateau_count}/{self.plateau_iterations})")
                
                if plateau_count >= self.plateau_iterations:
                    print(f"\n✓ Plateau reached ({self.plateau_iterations} iterations without improvement)")
                    stopping_reason = 'plateau'
                    current_score = new_score
                    break
            else:
                plateau_count = 0  # 重置平台期计数
            
            current_score = new_score
        
        # 检查是否达到最大迭代次数
        if iteration >= self.max_iterations:
            print(f"\n✓ Max iterations reached ({self.max_iterations})")
            stopping_reason = 'max_iterations'
        
        # 保存增强后的文档
        try:
            with open(requirements_path, 'w', encoding='utf-8') as f:
                f.write(current_content)
            print(f"\n✓ Saved enhanced document to {requirements_path}")
        except Exception as e:
            print(f"\n✗ Failed to save document: {e}")
            return EnhancementResult(
                success=False,
                document_type='requirements',
                initial_score=initial_score,
                final_score=current_score,
                iterations=iteration,
                improvements_applied=all_applied,
                improvements_failed=all_failed,
                stopping_reason=f"file_write_error: {e}",
                score_history=score_history
            )
        
        # 生成报告
        print(f"\n{'='*60}")
        print(f"Enhancement Complete")
        print(f"{'='*60}")
        print(f"Initial Score: {initial_score:.2f}/10")
        print(f"Final Score: {current_score:.2f}/10")
        print(f"Improvement: +{current_score - initial_score:.2f}")
        print(f"Iterations: {iteration}")
        print(f"Stopping Reason: {stopping_reason}")
        print(f"Applied Improvements: {len(all_applied)}")
        print(f"Failed Improvements: {len(all_failed)}")
        print(f"{'='*60}\n")
        
        return EnhancementResult(
            success=True,
            document_type='requirements',
            initial_score=initial_score,
            final_score=current_score,
            iterations=iteration,
            improvements_applied=all_applied,
            improvements_failed=all_failed,
            stopping_reason=stopping_reason,
            score_history=score_history
        )
    
    def enhance_design_completeness(self, design_path: str, requirements_path: str) -> EnhancementResult:
        """
        增强 Design 文档完整性
        
        Args:
            design_path: Design 文档路径
            requirements_path: Requirements 文档路径
        
        Returns:
            EnhancementResult: 增强结果
        """
        print(f"\n{'='*60}")
        print(f"Enhancing Design: {design_path}")
        print(f"{'='*60}\n")
        
        # 读取文档
        try:
            with open(design_path, 'r', encoding='utf-8') as f:
                design_content = f.read()
            with open(requirements_path, 'r', encoding='utf-8') as f:
                requirements_content = f.read()
        except Exception as e:
            return EnhancementResult(
                success=False,
                document_type='design',
                initial_score=0.0,
                final_score=0.0,
                iterations=0,
                stopping_reason=f"file_read_error: {e}"
            )
        
        # 初始评估
        initial_assessment = self.evaluator.assess_design_quality(
            design_content, 
            requirements_content
        )
        initial_score = initial_assessment.score
        
        print(f"Initial Score: {initial_score:.2f}/10")
        print(f"Language: {initial_assessment.language}")
        print(f"Missing Sections: {initial_assessment.missing_sections}")
        print(f"Issues: {len(initial_assessment.issues)}\n")
        
        # 检查是否已达到阈值
        if initial_score >= self.quality_threshold:
            print(f"✓ Already meets quality threshold ({self.quality_threshold})")
            return EnhancementResult(
                success=True,
                document_type='design',
                initial_score=initial_score,
                final_score=initial_score,
                iterations=0,
                stopping_reason='threshold_reached',
                score_history=[initial_score]
            )
        
        # 开始改进循环
        current_content = design_content
        current_score = initial_score
        score_history = [initial_score]
        all_applied = []
        all_failed = []
        iteration = 0
        plateau_count = 0
        
        while iteration < self.max_iterations:
            iteration += 1
            print(f"\n--- Iteration {iteration}/{self.max_iterations} ---")
            
            # 评估当前质量
            assessment = self.evaluator.assess_design_quality(
                current_content, 
                requirements_content
            )
            
            # 识别改进
            improvements = self.identifier.identify_design_improvements(
                current_content,
                requirements_content,
                assessment
            )
            
            if not improvements:
                print("✓ No more improvements identified")
                stopping_reason = 'no_improvements'
                break
            
            print(f"Identified {len(improvements)} improvements")
            
            # 应用改进
            result = self.applicator.apply_design_improvements(
                current_content,
                improvements,
                requirements_content,
                language=assessment.language
            )
            
            print(f"Applied {len(result.applied_improvements)} improvements")
            print(f"Failed {len(result.failed_improvements)} improvements")
            
            # 更新内容
            current_content = result.modified_content
            all_applied.extend(result.applied_improvements)
            all_failed.extend(result.failed_improvements)
            
            # 重新评估
            new_assessment = self.evaluator.assess_design_quality(
                current_content, 
                requirements_content
            )
            new_score = new_assessment.score
            score_history.append(new_score)
            
            score_delta = new_score - current_score
            print(f"Score: {current_score:.2f} → {new_score:.2f} (Δ{score_delta:+.2f})")
            
            # 检查收敛条件
            
            # 1. 达到阈值
            if new_score >= self.quality_threshold:
                print(f"\n✓ Quality threshold reached ({self.quality_threshold})")
                stopping_reason = 'threshold_reached'
                current_score = new_score
                break
            
            # 2. 分数无改进（平台期）
            if score_delta < self.min_score_improvement:
                plateau_count += 1
                print(f"⚠ Plateau detected ({plateau_count}/{self.plateau_iterations})")
                
                if plateau_count >= self.plateau_iterations:
                    print(f"\n✓ Plateau reached ({self.plateau_iterations} iterations without improvement)")
                    stopping_reason = 'plateau'
                    current_score = new_score
                    break
            else:
                plateau_count = 0
            
            current_score = new_score
        
        # 检查是否达到最大迭代次数
        if iteration >= self.max_iterations:
            print(f"\n✓ Max iterations reached ({self.max_iterations})")
            stopping_reason = 'max_iterations'
        
        # 保存增强后的文档
        try:
            with open(design_path, 'w', encoding='utf-8') as f:
                f.write(current_content)
            print(f"\n✓ Saved enhanced document to {design_path}")
        except Exception as e:
            print(f"\n✗ Failed to save document: {e}")
            return EnhancementResult(
                success=False,
                document_type='design',
                initial_score=initial_score,
                final_score=current_score,
                iterations=iteration,
                improvements_applied=all_applied,
                improvements_failed=all_failed,
                stopping_reason=f"file_write_error: {e}",
                score_history=score_history
            )
        
        # 生成报告
        print(f"\n{'='*60}")
        print(f"Enhancement Complete")
        print(f"{'='*60}")
        print(f"Initial Score: {initial_score:.2f}/10")
        print(f"Final Score: {current_score:.2f}/10")
        print(f"Improvement: +{current_score - initial_score:.2f}")
        print(f"Iterations: {iteration}")
        print(f"Stopping Reason: {stopping_reason}")
        print(f"Applied Improvements: {len(all_applied)}")
        print(f"Failed Improvements: {len(all_failed)}")
        print(f"{'='*60}\n")
        
        return EnhancementResult(
            success=True,
            document_type='design',
            initial_score=initial_score,
            final_score=current_score,
            iterations=iteration,
            improvements_applied=all_applied,
            improvements_failed=all_failed,
            stopping_reason=stopping_reason,
            score_history=score_history
        )
    
    def validate_tasks_completeness(self, tasks_path: str) -> EnhancementResult:
        """
        验证 Tasks 文档完整性
        
        Args:
            tasks_path: Tasks 文档路径
        
        Returns:
            EnhancementResult: 验证结果
        """
        print(f"\n{'='*60}")
        print(f"Validating Tasks: {tasks_path}")
        print(f"{'='*60}\n")
        
        # 读取文档
        try:
            with open(tasks_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            return EnhancementResult(
                success=False,
                document_type='tasks',
                initial_score=0.0,
                final_score=0.0,
                iterations=0,
                stopping_reason=f"file_read_error: {e}"
            )
        
        # 评估
        assessment = self.evaluator.assess_tasks_quality(content)
        score = assessment.score
        
        print(f"Completion Score: {score:.2f}/10")
        print(f"Issues: {assessment.issues}\n")
        
        # Tasks 文档不需要增强，只需要验证
        return EnhancementResult(
            success=True,
            document_type='tasks',
            initial_score=score,
            final_score=score,
            iterations=0,
            stopping_reason='validation_only',
            score_history=[score]
        )


def main():
    """命令行入口"""
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python ultrawork_enhancer_v3.py <command> <path> [requirements_path]")
        print("Commands:")
        print("  requirements <path>              - Enhance requirements document")
        print("  design <path> <requirements>     - Enhance design document")
        print("  tasks <path>                     - Validate tasks document")
        sys.exit(1)
    
    command = sys.argv[1]
    path = sys.argv[2]
    
    enhancer = UltraworkEnhancerV3()
    
    if command == 'requirements':
        result = enhancer.enhance_requirements_quality(path)
    elif command == 'design':
        if len(sys.argv) < 4:
            print("Error: design command requires requirements path")
            sys.exit(1)
        requirements_path = sys.argv[3]
        result = enhancer.enhance_design_completeness(path, requirements_path)
    elif command == 'tasks':
        result = enhancer.validate_tasks_completeness(path)
    else:
        print(f"Error: Unknown command '{command}'")
        sys.exit(1)
    
    # 返回退出码
    sys.exit(0 if result.success else 1)


if __name__ == '__main__':
    main()
