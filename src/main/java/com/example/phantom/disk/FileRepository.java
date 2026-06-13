package com.example.phantom.disk;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface FileRepository extends JpaRepository<File, UUID> {

}
