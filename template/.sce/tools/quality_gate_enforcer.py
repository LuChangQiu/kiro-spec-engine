#!/usr/bin/env python3
"""
Quality Gate Enforcer - 质量门控组件

负责在 Spec 创建工作流中强制执行质量标准
"""

from dataclasses import dataclass
from typing import Optional
from ultrawork_enhancer_v3 import UltraworkEnhancerV3, EnhancementResult


@dataclass
class GateResult:
    """质量门结果"""
    passed: bool
    score: float
    threshold: float
    enhancement_result: Optional[EnhancementResult] = None
    message: str = ""


class QualityGateEnforcer:
    """
    质量门控器 - 强制执行质量标准
    
    集成到 Spec 创建工作流，确保文档达到质量阈值
    """
    
    def __init__(self, 
                 requirements_threshold: float = 9.0,
                 design_threshold: float = 9.0,
                 tasks_threshold: float = 8.0):
        """
        初始化质量门控器
        
        Args:
            requirements_threshold: Requirements 质量阈值
            design_threshold: Design 质量阈值
            tasks_threshold: Tasks 质量阈值
        """
        self.requirements_threshold = requirements_threshold
        self.design_threshold = design_threshold
        self.tasks_threshold = tasks_threshold
        
        # 创建增强器实例
        self.enhancer = UltraworkEnhancerV3(
            quality_threshold=requirements_threshold,
            max_iterations=10,
            plateau_iterations=3,
            create_backups=True,
            cleanup_backups_on_success=True
        )
    
    def check_requirements_gate(self, requirements_path: str) -> GateResult:
        """
        检查 Requirements 质量门
        
        Args:
            requirements_path: Requirements 文档路径
        
        Returns:
            GateResult: 质量门结果
        """
        print(f"\n{'='*60}")
        print(f"Quality Gate: Requirements")
        print(f"Threshold: {self.requirements_threshold}/10")
        print(f"{'='*60}\n")
        
        # 设置阈值
        self.enhancer.set_quality_threshold(self.requirements_threshold)
        
        # 执行增强
        result = self.enhancer.enhance_requirements_quality(requirements_path)
        
        # 检查是否通过
        passed = result.final_score >= self.requirements_threshold
        
        if passed:
            message = f"✓ Requirements quality gate PASSED ({result.final_score:.2f}/{self.requirements_threshold})"
        else:
            message = f"✗ Requirements quality gate FAILED ({result.final_score:.2f}/{self.requirements_threshold})"
        
        print(f"\n{message}\n")
        
        return GateResult(
            passed=passed,
            score=result.final_score,
            threshold=self.requirements_threshold,
            enhancement_result=result,
            message=message
        )
    
    def check_design_gate(self, design_path: str, requirements_path: str) -> GateResult:
        """
        检查 Design 质量门
        
        Args:
            design_path: Design 文档路径
            requirements_path: Requirements 文档路径
        
        Returns:
            GateResult: 质量门结果
        """
        print(f"\n{'='*60}")
        print(f"Quality Gate: Design")
        print(f"Threshold: {self.design_threshold}/10")
        print(f"{'='*60}\n")
        
        # 设置阈值
        self.enhancer.set_quality_threshold(self.design_threshold)
        
        # 执行增强
        result = self.enhancer.enhance_design_completeness(design_path, requirements_path)
        
        # 检查是否通过
        passed = result.final_score >= self.design_threshold
        
        if passed:
            message = f"✓ Design quality gate PASSED ({result.final_score:.2f}/{self.design_threshold})"
        else:
            message = f"✗ Design quality gate FAILED ({result.final_score:.2f}/{self.design_threshold})"
        
        print(f"\n{message}\n")
        
        return GateResult(
            passed=passed,
            score=result.final_score,
            threshold=self.design_threshold,
            enhancement_result=result,
            message=message
        )
    
    def check_tasks_gate(self, tasks_path: str) -> GateResult:
        """
        检查 Tasks 质量门
        
        Args:
            tasks_path: Tasks 文档路径
        
        Returns:
            GateResult: 质量门结果
        """
        print(f"\n{'='*60}")
        print(f"Quality Gate: Tasks")
        print(f"Threshold: {self.tasks_threshold}/10")
        print(f"{'='*60}\n")
        
        # 执行验证
        result = self.enhancer.validate_tasks_completeness(tasks_path)
        
        # 检查是否通过
        passed = result.final_score >= self.tasks_threshold
        
        if passed:
            message = f"✓ Tasks quality gate PASSED ({result.final_score:.2f}/{self.tasks_threshold})"
        else:
            message = f"✗ Tasks quality gate FAILED ({result.final_score:.2f}/{self.tasks_threshold})"
        
        print(f"\n{message}\n")
        
        return GateResult(
            passed=passed,
            score=result.final_score,
            threshold=self.tasks_threshold,
            enhancement_result=result,
            message=message
        )


def main():
    """命令行入口"""
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python quality_gate_enforcer.py <gate> <path> [requirements_path]")
        print("Gates:")
        print("  requirements <path>              - Check requirements quality gate")
        print("  design <path> <requirements>     - Check design quality gate")
        print("  tasks <path>                     - Check tasks quality gate")
        sys.exit(1)
    
    gate = sys.argv[1]
    path = sys.argv[2]
    
    enforcer = QualityGateEnforcer()
    
    if gate == 'requirements':
        result = enforcer.check_requirements_gate(path)
    elif gate == 'design':
        if len(sys.argv) < 4:
            print("Error: design gate requires requirements path")
            sys.exit(1)
        requirements_path = sys.argv[3]
        result = enforcer.check_design_gate(path, requirements_path)
    elif gate == 'tasks':
        result = enforcer.check_tasks_gate(path)
    else:
        print(f"Error: Unknown gate '{gate}'")
        sys.exit(1)
    
    # 返回退出码：0 = 通过，1 = 失败
    sys.exit(0 if result.passed else 1)


if __name__ == '__main__':
    main()
