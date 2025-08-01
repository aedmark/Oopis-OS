// scripts/comm_utils.js

class TimestampParser {
  static parseDateString(dateStr) {
    if (typeof dateStr !== "string") return null;

    const absoluteDate = new Date(dateStr);
    if (!isNaN(absoluteDate.getTime())) {
      if (
          isNaN(parseInt(dateStr.trim(), 10)) ||
          !/^\d+$/.test(dateStr.trim())
      ) {
        return absoluteDate;
      }
    }

    const relativeMatch = dateStr.match(
        /([-+]?\d+)\s*(minute|hour|day|week|month|year)s?(\s+ago)?/i
    );

    if (relativeMatch) {
      let amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      const isAgo = !!relativeMatch[3];

      if (isAgo) {
        amount = -Math.abs(amount);
      }

      const now = new Date();

      switch (unit) {
        case "minute":
          now.setMinutes(now.getMinutes() + amount);
          break;
        case "hour":
          now.setHours(now.getHours() + amount);
          break;
        case "day":
          now.setDate(now.getDate() + amount);
          break;
        case "week":
          now.setDate(now.getDate() + amount * 7);
          break;
        case "month":
          now.setMonth(now.getMonth() + amount);
          break;
        case "year":
          now.setFullYear(now.getFullYear() + amount);
          break;
        default:
          return null;
      }
      return now;
    }

    return null;
  }

  static parseStampToISO(stampStr) {
    let year,
        monthVal,
        day,
        hours,
        minutes,
        seconds = 0;
    let s = stampStr;
    if (s.includes(".")) {
      const parts = s.split(".");
      if (
          parts.length !== 2 ||
          parts[1].length !== 2 ||
          isNaN(parseInt(parts[1], 10))
      )
        return null;
      seconds = parseInt(parts[1], 10);
      if (seconds < 0 || seconds > 59) return null;
      s = parts[0];
    }
    if (s.length === 12) {
      year = parseInt(s.substring(0, 4), 10);
      monthVal = parseInt(s.substring(4, 6), 10);
      day = parseInt(s.substring(6, 8), 10);
      hours = parseInt(s.substring(8, 10), 10);
      minutes = parseInt(s.substring(10, 12), 10);
    } else if (s.length === 10) {
      const YY = parseInt(s.substring(0, 2), 10);
      if (isNaN(YY)) return null;
      year = YY < 69 ? 2000 + YY : 1900 + YY;
      monthVal = parseInt(s.substring(2, 4), 10);
      day = parseInt(s.substring(4, 6), 10);
      hours = parseInt(s.substring(6, 8), 10);
      minutes = parseInt(s.substring(8, 10), 10);
    } else return null;
    if (
        isNaN(year) ||
        isNaN(monthVal) ||
        isNaN(day) ||
        isNaN(hours) ||
        isNaN(minutes)
    )
      return null;
    if (
        monthVal < 1 ||
        monthVal > 12 ||
        day < 1 ||
        day > 31 ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    )
      return null;
    const dateObj = new Date(
        Date.UTC(year, monthVal - 1, day, hours, minutes, seconds)
    );
    if (
        dateObj.getUTCFullYear() !== year ||
        dateObj.getUTCMonth() !== monthVal - 1 ||
        dateObj.getUTCDate() !== day ||
        dateObj.getUTCHours() !== hours ||
        dateObj.getUTCMinutes() !== minutes ||
        dateObj.getUTCSeconds() !== seconds
    )
      return null;
    return dateObj.toISOString();
  }

  static resolveTimestampFromCommandFlags(flags, commandName) {
    if (flags.dateString && flags.stamp) {
      return {
        timestampISO: null,
        error: `${commandName}: cannot use both --date and --stamp flags simultaneously.`,
      };
    }
    if (flags.dateString) {
      const parsedDate = this.parseDateString(flags.dateString);
      if (!parsedDate) {
        return {
          timestampISO: null,
          error: `${commandName}: invalid date string format '${flags.dateString}'`,
        };
      }
      return { timestampISO: parsedDate.toISOString(), error: null };
    }
    if (flags.stamp) {
      const parsedISO = this.parseStampToISO(flags.stamp);
      if (!parsedISO) {
        return {
          timestampISO: null,
          error: `${commandName}: invalid stamp format '${flags.stamp}' (expected [[CC]YY]MMDDhhmm[.ss])`,
        };
      }
      return { timestampISO: parsedISO, error: null };
    }
    return { timestampISO: new Date().toISOString(), error: null };
  }
}

class DiffUtils {
  static compare(textA, textB) {
    if (textA === textB) {
      return "";
    }

    const a = textA.split("\n");
    const b = textB.split("\n");

    if (a.length > 0 && a[a.length - 1] === '') {
      a.pop();
    }
    if (b.length > 0 && b[b.length - 1] === '') {
      b.pop();
    }

    const N = a.length;
    const M = b.length;
    const max = N + M;
    const v = new Array(2 * max + 1).fill(0);
    const trace = [];

    for (let d = 0; d <= max; d++) {
      trace.push([...v]);
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
          x = v[k + 1 + max];
        } else {
          x = v[k - 1 + max] + 1;
        }
        let y = x - k;
        while (x < N && y < M && a[x] === b[y]) {
          x++;
          y++;
        }
        v[k + max] = x;
        if (x >= N && y >= M) {
          let diffOutput = [];
          let px = N;
          let py = M;

          for (let td = d; td > 0; td--) {
            const prev_v = trace[td - 1];
            const p_k = px - py;
            let prev_k;
            if (
                p_k === -td ||
                (p_k !== td && prev_v[p_k - 1 + max] < prev_v[p_k + 1 + max])
            ) {
              prev_k = p_k + 1;
            } else {
              prev_k = p_k - 1;
            }
            let prev_x = prev_v[prev_k + max];
            let prev_y = prev_x - prev_k;
            while (px > prev_x && py > prev_y) {
              diffOutput.unshift(`  ${a[px - 1]}`);
              px--;
              py--;
            }
            if (td > 0) {
              if (prev_x < px) {
                diffOutput.unshift(`< ${a[px - 1]}`);
              } else {
                diffOutput.unshift(`> ${b[py - 1]}`);
              }
            }
            px = prev_x;
            py = prev_y;
          }
          while (px > 0 && py > 0) {
            diffOutput.unshift(`  ${a[px - 1]}`);
            px--;
            py--;
          }
          return diffOutput.join("\n");
        }
      }
    }
    return "";
  }
}

class PatchUtils {
  static createPatch(oldText, newText) {
    if (oldText === newText) {
      return null;
    }
    let start = 0;
    while (
        start < oldText.length &&
        start < newText.length &&
        oldText[start] === newText[start]
        ) {
      start++;
    }
    let oldEnd = oldText.length;
    let newEnd = newText.length;
    while (
        oldEnd > start &&
        newEnd > start &&
        oldText[oldEnd - 1] === newText[newEnd - 1]
        ) {
      oldEnd--;
      newEnd--;
    }
    const deletedText = oldText.substring(start, oldEnd);
    const insertedText = newText.substring(start, newEnd);
    return {
      index: start,
      delete: deletedText.length,
      insert: insertedText,
      deleted: deletedText,
    };
  }

  static applyPatch(originalContent, hunks) {
    if (!hunks || hunks.length === 0) {
      return originalContent;
    }

    const lines = originalContent.split('\n');
    let offset = 0;

    for (const hunk of hunks) {
      const insertLines = [];
      const removeLines = [];
      let contextLinesCount = 0;

      for(const line of hunk.lines){
        if(line.startsWith('+')){
          insertLines.push(line.substring(1));
        } else if (line.startsWith('-')){
          removeLines.push(line.substring(1));
        } else {
          contextLinesCount++;
        }
      }

      const startIndex = hunk.oldStart - 1 + offset;
      const linesToRemove = lines.slice(startIndex, startIndex + removeLines.length + contextLinesCount);
      lines.splice(startIndex, removeLines.length);
      for (let i = 0; i < insertLines.length; i++) {
        lines.splice(startIndex + i, 0, insertLines[i]);
      }

      offset += (insertLines.length - removeLines.length);
    }

    return lines.join('\n');
  }

  static applyInverse(text, patch) {
    const head = text.substring(0, patch.index);
    const tail = text.substring(patch.index + patch.insert.length);
    return head + patch.deleted + tail;
  }
}