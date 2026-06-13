package com.example.phantom.disk.usage;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DiskUsageRepository extends JpaRepository<DiskUsage, Long> {
}
