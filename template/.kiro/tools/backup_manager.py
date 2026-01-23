#!/usr/bin/env python3
"""
Backup Manager - 备份管理组件

负责创建和管理文档备份，支持回滚操作
"""

import os
import shutil
from datetime import datetime
from typing import List, Optional
from dataclasses import dataclass
from pathlib import Path


@dataclass
class BackupInfo:
    """备份信息"""
    backup_id: str
    original_path: str
    backup_path: str
    timestamp: datetime
    reason: str
    size_bytes: int


class BackupManager:
    """
    备份管理器 - 创建和管理文档备份
    
    支持备份创建、恢复和清理
    """
    
    def __init__(self, backup_dir: Optional[str] = None):
        """
        初始化备份管理器
        
        Args:
            backup_dir: 备份目录路径，默认为 None（自动确定）
        """
        self.backup_dir = backup_dir
        self.backups = {}  # backup_id -> BackupInfo
    
    def _get_backup_dir(self, file_path: str) -> str:
        """
        获取备份目录路径
        
        Args:
            file_path: 原始文件路径
        
        Returns:
            str: 备份目录路径
        """
        if self.backup_dir:
            return self.backup_dir
        
        # 自动确定备份目录：.kiro/specs/{spec-name}/backups/
        file_path_obj = Path(file_path)
        
        # 查找 .kiro/specs/ 目录
        current = file_path_obj.parent
        while current != current.parent:
            if current.name == 'specs' and current.parent.name == '.kiro':
                # 找到 specs 目录，使用当前文件所在的 spec 目录
                spec_dir = file_path_obj.parent
                backup_dir = spec_dir / 'backups'
                return str(backup_dir)
            current = current.parent
        
        # 如果找不到 specs 目录，使用文件所在目录的 backups 子目录
        return str(file_path_obj.parent / 'backups')
    
    def create_backup(self, file_path: str, reason: str = "enhancement") -> str:
        """
        创建文件备份
        
        Args:
            file_path: 要备份的文件路径
            reason: 备份原因
        
        Returns:
            str: 备份 ID
        
        Raises:
            FileNotFoundError: 文件不存在
            PermissionError: 没有权限
            IOError: 备份创建失败
        """
        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # 检查文件是否可读
        if not os.access(file_path, os.R_OK):
            raise PermissionError(f"Permission denied: {file_path}")
        
        # 获取备份目录
        backup_dir = self._get_backup_dir(file_path)
        
        # 创建备份目录（如果不存在）
        os.makedirs(backup_dir, exist_ok=True)
        
        # 生成备份 ID 和备份文件名
        timestamp = datetime.now()
        timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S_%f")
        file_name = os.path.basename(file_path)
        backup_id = f"{file_name}.backup-{timestamp_str}"
        backup_path = os.path.join(backup_dir, backup_id)
        
        # 复制文件
        try:
            shutil.copy2(file_path, backup_path)
        except Exception as e:
            raise IOError(f"Failed to create backup: {e}")
        
        # 获取文件大小
        size_bytes = os.path.getsize(backup_path)
        
        # 记录备份信息
        backup_info = BackupInfo(
            backup_id=backup_id,
            original_path=file_path,
            backup_path=backup_path,
            timestamp=timestamp,
            reason=reason,
            size_bytes=size_bytes
        )
        
        self.backups[backup_id] = backup_info
        
        return backup_id
    
    def restore_backup(self, backup_id: str) -> bool:
        """
        从备份恢复文件
        
        Args:
            backup_id: 备份 ID
        
        Returns:
            bool: 恢复是否成功
        
        Raises:
            ValueError: 备份 ID 不存在
            IOError: 恢复失败
        """
        # 检查备份是否存在
        if backup_id not in self.backups:
            raise ValueError(f"Backup not found: {backup_id}")
        
        backup_info = self.backups[backup_id]
        
        # 检查备份文件是否存在
        if not os.path.exists(backup_info.backup_path):
            raise IOError(f"Backup file not found: {backup_info.backup_path}")
        
        # 恢复文件
        try:
            shutil.copy2(backup_info.backup_path, backup_info.original_path)
            return True
        except Exception as e:
            raise IOError(f"Failed to restore backup: {e}")
    
    def cleanup_backup(self, backup_id: str) -> bool:
        """
        清理备份文件
        
        Args:
            backup_id: 备份 ID
        
        Returns:
            bool: 清理是否成功
        """
        # 检查备份是否存在
        if backup_id not in self.backups:
            return False
        
        backup_info = self.backups[backup_id]
        
        # 删除备份文件
        try:
            if os.path.exists(backup_info.backup_path):
                os.remove(backup_info.backup_path)
            
            # 从记录中移除
            del self.backups[backup_id]
            
            return True
        except Exception:
            return False
    
    def list_backups(self, file_path: Optional[str] = None) -> List[BackupInfo]:
        """
        列出备份
        
        Args:
            file_path: 原始文件路径（可选），如果提供则只列出该文件的备份
        
        Returns:
            List[BackupInfo]: 备份信息列表
        """
        if file_path:
            # 只返回指定文件的备份
            return [
                info for info in self.backups.values()
                if info.original_path == file_path
            ]
        else:
            # 返回所有备份
            return list(self.backups.values())
    
    def cleanup_all_backups(self) -> int:
        """
        清理所有备份
        
        Returns:
            int: 清理的备份数量
        """
        count = 0
        backup_ids = list(self.backups.keys())
        
        for backup_id in backup_ids:
            if self.cleanup_backup(backup_id):
                count += 1
        
        return count
    
    def get_backup_info(self, backup_id: str) -> Optional[BackupInfo]:
        """
        获取备份信息
        
        Args:
            backup_id: 备份 ID
        
        Returns:
            Optional[BackupInfo]: 备份信息，如果不存在则返回 None
        """
        return self.backups.get(backup_id)


def main():
    """测试备份管理器"""
    import tempfile
    
    # 创建临时文件
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md') as f:
        f.write("# Test Document\n\nThis is a test.")
        temp_file = f.name
    
    print(f"Created test file: {temp_file}")
    
    # 创建备份管理器
    manager = BackupManager()
    
    # 创建备份
    print("\n1. Creating backup...")
    backup_id = manager.create_backup(temp_file, reason="test")
    print(f"   Backup ID: {backup_id}")
    
    # 列出备份
    print("\n2. Listing backups...")
    backups = manager.list_backups(temp_file)
    for backup in backups:
        print(f"   - {backup.backup_id}")
        print(f"     Path: {backup.backup_path}")
        print(f"     Size: {backup.size_bytes} bytes")
        print(f"     Reason: {backup.reason}")
    
    # 修改原文件
    print("\n3. Modifying original file...")
    with open(temp_file, 'w') as f:
        f.write("# Modified Document\n\nThis has been modified.")
    
    with open(temp_file, 'r') as f:
        print(f"   Content: {f.read()}")
    
    # 恢复备份
    print("\n4. Restoring backup...")
    manager.restore_backup(backup_id)
    
    with open(temp_file, 'r') as f:
        print(f"   Restored content: {f.read()}")
    
    # 清理备份
    print("\n5. Cleaning up backup...")
    manager.cleanup_backup(backup_id)
    print(f"   Remaining backups: {len(manager.list_backups(temp_file))}")
    
    # 清理临时文件
    os.remove(temp_file)
    print(f"\n6. Cleaned up test file")


if __name__ == '__main__':
    main()
