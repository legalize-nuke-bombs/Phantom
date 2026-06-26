package com.example.phantom.chat.chat;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class PostChatRequest {
    @NotNull
    private ChatType type;

    @Size(min = 1, max = 255)
    private String name;

    @Size(max = 1000)
    private List<@NotNull Long> userIds;
}
