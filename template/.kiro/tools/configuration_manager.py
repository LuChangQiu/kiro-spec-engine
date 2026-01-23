#!/usr/bin/env python3
"""
Configuration Manager - 配置管理器

管理 Ultrawork 增强器的配置
注意：这是一个轻量级实现，基本配置功能已集成在 UltraworkEnhancerV3 中
"""

import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional, Dict, Any


@dataclass
class UltraworkConfig:
    """Ultrawork 配置数据结构"""
    # 质量阈值
    requirements_threshold: float = 9.0
    design_threshold: float = 9.0
    tasks_threshold: float = 8.0
    
    # 收敛控制
    max_iterations: int = 10
    plateau_iterations: int = 3
    min_improvement: float = 0.1
    
    # 备份设置
    create_backups: bool = True
    cleanup_backups_on_success: bool = True
    backup_retention_days: int = 7
    
    # 日志设置
    enable_logging: bool = True
    log_file: Optional[str] = None
    verbose: bool = False
    
    # 评分权重 - Requirements
    req_structure_weight: float = 0.20
    req_ears_weight: float = 0.20
    req_stories_weight: float = 0.20
    req_criteria_weight: float = 0.20
    req_nfr_weight: float = 0.10
    req_constraints_weight: float = 0.10
    
    # 评分权重 - Design
    design_structure_weight: float = 0.25
    design_traceability_weight: float = 0.20
    design_components_weight: float = 0.20
    design_diagrams_weight: float = 0.15
    design_technology_weight: float = 0.10
    design_nfr_weight: float = 0.05
    design_interfaces_weight: float = 0.05


class ConfigurationManager:
    """
    配置管理器
    
    支持项目级和 Spec 级配置，Spec 级配置优先
    """
    
    DEFAULT_PROJECT_CONFIG_PATH = ".kiro/ultrawork-config.json"
    SPEC_CONFIG_FILENAME = "ultrawork-config.json"
    
    def __init__(self):
        """初始化配置管理器"""
        self.config = UltraworkConfig()
    
    def load_config(self, spec_path: Optional[str] = None) -> UltraworkConfig:
        """
        加载配置
        
        优先级：Spec 级 > 项目级 > 默认值
        
        Args:
            spec_path: Spec 目录路径（可选）
        
        Returns:
            配置对象
        """
        # 从默认值开始
        config_dict = asdict(self.config)
        
        # 加载项目级配置
        project_config = self._load_project_config()
        if project_config:
            config_dict.update(project_config)
        
        # 加载 Spec 级配置（如果提供）
        if spec_path:
            spec_config = self._load_spec_config(spec_path)
            if spec_config:
                config_dict.update(spec_config)
        
        # 验证配置
        config_dict = self._validate_config(config_dict)
        
        # 创建配置对象
        self.config = UltraworkConfig(**config_dict)
        return self.config
    
    def save_config(self, config: UltraworkConfig, 
                    spec_path: Optional[str] = None) -> bool:
        """
        保存配置
        
        Args:
            config: 配置对象
            spec_path: Spec 目录路径（可选，如果提供则保存为 Spec 级配置）
        
        Returns:
            是否成功
        """
        try:
            config_dict = asdict(config)
            
            if spec_path:
                # 保存为 Spec 级配置
                config_path = Path(spec_path) / self.SPEC_CONFIG_FILENAME
            else:
                # 保存为项目级配置
                config_path = Path(self.DEFAULT_PROJECT_CONFIG_PATH)
            
            config_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config_dict, f, indent=2, ensure_ascii=False)
            
            return True
        
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
    
    def _load_project_config(self) -> Optional[Dict[str, Any]]:
        """加载项目级配置"""
        config_path = Path(self.DEFAULT_PROJECT_CONFIG_PATH)
        
        if not config_path.exists():
            return None
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load project config: {e}")
            return None
    
    def _load_spec_config(self, spec_path: str) -> Optional[Dict[str, Any]]:
        """加载 Spec 级配置"""
        config_path = Path(spec_path) / self.SPEC_CONFIG_FILENAME
        
        if not config_path.exists():
            return None
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load spec config: {e}")
            return None
    
    def _validate_config(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证配置值
        
        Args:
            config_dict: 配置字典
        
        Returns:
            验证后的配置字典
        """
        # 验证阈值范围 (0-10)
        for key in ['requirements_threshold', 'design_threshold', 'tasks_threshold']:
            if key in config_dict:
                config_dict[key] = max(0.0, min(10.0, config_dict[key]))
        
        # 验证迭代次数 (1-100)
        if 'max_iterations' in config_dict:
            config_dict['max_iterations'] = max(1, min(100, config_dict['max_iterations']))
        
        if 'plateau_iterations' in config_dict:
            config_dict['plateau_iterations'] = max(1, min(10, config_dict['plateau_iterations']))
        
        # 验证权重总和 = 1.0
        req_weights = [
            'req_structure_weight', 'req_ears_weight', 'req_stories_weight',
            'req_criteria_weight', 'req_nfr_weight', 'req_constraints_weight'
        ]
        if all(k in config_dict for k in req_weights):
            total = sum(config_dict[k] for k in req_weights)
            if abs(total - 1.0) > 0.01:
                print(f"Warning: Requirements weights sum to {total:.2f}, normalizing to 1.0")
                for k in req_weights:
                    config_dict[k] /= total
        
        design_weights = [
            'design_structure_weight', 'design_traceability_weight', 
            'design_components_weight', 'design_diagrams_weight',
            'design_technology_weight', 'design_nfr_weight', 'design_interfaces_weight'
        ]
        if all(k in config_dict for k in design_weights):
            total = sum(config_dict[k] for k in design_weights)
            if abs(total - 1.0) > 0.01:
                print(f"Warning: Design weights sum to {total:.2f}, normalizing to 1.0")
                for k in design_weights:
                    config_dict[k] /= total
        
        return config_dict
    
    def get_default_config(self) -> UltraworkConfig:
        """获取默认配置"""
        return UltraworkConfig()


# 注意：基本配置功能已集成在 ultrawork_enhancer_v3.py 的 UltraworkEnhancerV3 类中
# 本类提供更完整的配置文件管理，可选使用
