package com.example.phantom.disk.ref;

import com.example.phantom.chat.message.MessageRepository;
import com.example.phantom.disk.AdvancedFileRepresentation;
import com.example.phantom.disk.FileRepresentation;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DiskRefCounterService {

    private final MessageRepository messageRepository;

    public DiskRefCounterService(MessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    public List<AdvancedFileRepresentation> count(List<FileRepresentation> files) {
        List<Object[]> raw = messageRepository.countByFileIds(
                files.stream().map(FileRepresentation::getId).toList()
        );
        Map<UUID, Long> map = raw.stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (Long) row[1]
                ));
        return files.stream().map(f -> new AdvancedFileRepresentation(f, map.getOrDefault(f.getId(), 0L))).toList();
    }
}
