package com.example.phantom.chat.banlist;

import com.example.phantom.user.UserRepresentation;
import lombok.Getter;

@Getter
public class BanRepresentation {
    private final Long timestamp;
    private final UserRepresentation moderator;
    private final Long duration;
    private final String reason;

    public BanRepresentation(Ban ban) {
        this.timestamp = ban.getTimestamp();
        if (ban.getModerator() == null) { this.moderator = null; }
        else { this.moderator = new UserRepresentation(ban.getModerator()); }

        this.duration = ban.getDuration();
        this.reason = ban.getReason();
    }
}
